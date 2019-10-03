
function insertScript(s) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.type = 'text/javascript';
    script.src = s;
    head.appendChild(script);
}

function doLoadMap () {
    var savedCartography = getCookie("cartography");
    var queryCartography = window.location.queryParameters["cartography"] 
        ? (window.location.queryParameters["cartography"] == "google" ? "google" : "bing")
        : null;
    if (!savedCartography && queryCartography) {
        setCookie("cartography", queryCartography);
    }
    var cartography = queryCartography || savedCartography || "bing";

    window.map = cartography == "google" ? new GoogleMap() : new BingMap();
}


function mapModuleLoaded() {
    window.map.loaded(onMapLoaded || (() => {}));
}

class GoogleMap {
    constructor() {
        this.markers = new Array();
        insertScript('https://maps.googleapis.com/maps/api/js?key=' + window.keys.Client_Google_Map_K + '&callback=mapModuleLoaded');
    }
    loaded(onload) {
        $(() => {
            var centerFromCookie = getCookie("mapCenter");
            $("#mapTypeSelectorDiv").hide();
            var mapCenter = new google.maps.LatLng(52.068287, -4.747708);
            if (centerFromCookie) {
                let ll = centerFromCookie.split(",");
                if (ll.length == 2) {
                    mapCenter = new google.maps.LatLng(ll[0], ll[1]);
                }
            }
            this.map = new google.maps.Map(document.getElementById('theMap'),
                {
                    center: mapCenter,
                    zoom: 16,
                    clickableIcons: false,
                    fullscreenControl: false,
                    gestureHandling: "greedy",
                    keyboardShortcuts: false,
                    //mapTypeControl: false,
                    mapTypeId: "satellite"
                });
            this.map.addListener("click", function () {
                // console.log("click 1");
                clearMessageOrMapSelection();
            });
            if (!window.noHistory) {
                this.setUpMapMenu();
                this.setUpPlacePopup();
            }
            onload();
        })
    }
    
    setUpMapMenu() {
        this.menuBox = new google.maps.InfoWindow({
            content: "<a href='#' onclick='window.map.doAddPlace()'>Add place here</a>"
        });
        this.map.addListener("rightclick", function (e) {
            // console.log("rightclick 1");
            window.map.menuBox.setPosition(e.latLng);
            window.map.menuBox.open(window.map.map);
        });
    }
    doAddPlace() {
        var loc = window.map.menuBox.getPosition();
        window.map.menuBox.close();
        window.open("editor.htm?cmd=add&lat={0}&long={1}".format(loc.lat(), loc.lng()), "_blank");
    }
    setUpPlacePopup() {
        this.placePopup = new google.maps.InfoWindow({
            maxWidth: 400
        });
    }
    openPlacePopup(position, title, content, place) {
        this.placePopup.place = place;
        this.placePopup.place = place;
        this.placePopup.setContent("<div onclick='go(window.placePopup.place.id, false)'>"
            + "<h3>" + title + "</h3>" + content + "</div>");
        this.placePopup.setPosition(position);
        this.placePopup.open(this.map);
    }
    closePopup() {
        this.placePopup.close();
    }
    makePosition(lat, lng) { 
        return {latitude:lat, longitude: lng}; 
    }
    makePin(place) {
        if (place.cf.length > 0) {
            // console.log("makePin " + place.title);
            window.orderedList.push(place);
            if (place.text.length > 100) { window.interesting.push(place); }
            var options = this.pinOptions(place);
            var pushpin = new google.maps.Marker(options);
            this.markers.push(pushpin);
            pushpin.myColor = options.icon.strokeColor;
            pushpin.id = place.id;
            pushpin.place = place;
            place.pin = pushpin;

            pushpin.addListener("click", (e) => {
                // console.log("pin click 1");
                go(place.id, false);
            });

            if (!window.noHistory) {

                pushpin.addListener('mouseover', function (e) {
                    // console.log("pin over 1");
                    window.map.openPlacePopup(pushpin.getPosition(), place.title, popupText(place), place);
                });
                pushpin.addListener('mouseout', function (e) {
                    // console.log("pin out 1");
                    window.map.placePopup.close();
                });
            }
            pushpin.setMap(this.map);
        }
    }
    pinOptions(place) {
        var thisPinColor = place.principal ? "blue" : place.text.length > 100 ? "#FF0000" : "#A00000";
        return {
            map: this.map,
            label: place.title.replace(/&#39;/, "'").replace(/&quot;/, "\""),
            position: new google.maps.LatLng(place.location.latitude, place.location.longitude),
            icon: { path: google.maps.SymbolPath.CIRCLE, strokeColor: thisPinColor, fillColor: "white", scale: 6 }
        };
    }
    setPin(pin, place) {
        var options = this.pinOptions(place);
        pin.setOptions(options);
        pin.setPosition(new google.map.LatLng(place.location.latitude, place.location.longitude));
    }
    showPlace(place, zoom, shiftOffCentre) {
        if (zoom) {
            this.map.setZoom(zoom);
        }
        this.map.panTo(new google.maps.LatLng(place.location.latitude, place.location.longitude));
    }

    // Highlight place on map.

    // fromList : user chose place from the left-side index, not the map
    highlightPin(pin) {
        // Clear current highlight:
        if (this.selectedPin != null) {
            // myColor is an additional property we added to keep the default colour of each pin:
            this.selectedPin.getIcon().strokeColor = this.selectedPin.myColor;
        }
        this.selectedPin = pin;
        if (pin) {
            pin.getIcon().strokeColor = "#FF00F0";
        }
    }

    clear() {
        for (var i = 0; i<this.markers.length; i++) {
            this.markers[i].setMap(null);
        }
        this.markers = new Array();
    }
}

class BingMap {
    constructor() {
        // console.log("BingMap 1");
        insertScript('https://www.bing.com/api/maps/mapcontrol?key=' + window.keys.Client_Map_K + '&callback=mapModuleLoaded');
    }
    loaded(onload) {
        //$(() => {
        // console.log("BingMap.loaded 1");
        var mapCenter = new Microsoft.Maps.Location(52.068287, -4.747708);
        var centerFromCookie = getCookie("mapCenter");
        if (centerFromCookie) {
            mapCenter = Microsoft.Maps.Location.parseLatLong(centerFromCookie) || mapCenter;
        }
        this.map = new Microsoft.Maps.Map(document.getElementById('theMap'),
            {
                mapTypeId: Microsoft.Maps.MapTypeId.aerial,
                center: mapCenter,
                showLocateMeButton: false,
                disableKeyboardInput: true,
                zoom: 16
            });

        // console.log("BingMap.loaded 2");
        Microsoft.Maps.Events.addHandler(this.map, "click", function (e) {
            clearMessageOrMapSelection();
        });
        // Microsoft.Maps.Events.addHandler(this.map, 'viewchangeend', this.setStreetOsLayer);
        if (!window.noHistory) {
            this.setUpMapMenu();
            this.setUpPlacePopup();
        }

        Microsoft.Maps.Events.addHandler(this.map, 'viewchangeend', () => window.map.setStreetOsLayer());
        // console.log("BingMap.loaded 3");
        onload();
        // console.log("BingMap.loaded 4");
        //});
    }
    setUpMapMenu() {
        this.menuBox = new Microsoft.Maps.Infobox(
            this.map.getCenter(),
            {
                visible: false,
                showPointer: true,
                offset: new Microsoft.Maps.Point(0, 0),
                actions: [
                    {
                        label: "Add place here  .",
                        eventHandler: function () {
                            var loc = window.map.menuBox.getLocation();
                            window.map.menuBox.setOptions({ visible: false });
                            window.open("editor.htm?cmd=add&lat={0}&long={1}".format(loc.latitude, loc.longitude), "_blank");
                        }
                    }
                ]
            });
        this.menuBox.setMap(this.map);
        Microsoft.Maps.Events.addHandler(this.map, "rightclick",
            function (e) {
                window.map.menuBox.setOptions({
                    location: e.location,
                    visible: true
                });
            });
    }
    setUpPlacePopup() {
        //Create an infobox to show start of place text on hover
        this.placePopup = new Microsoft.Maps.Infobox(this.map.getCenter(), {
            visible: false,
            showCloseButton: false,
            offset: new Microsoft.Maps.Point(0, 10),
            description: "",
            maxWidth: 400,
            maxHeight: 200,
            showPointer: true
        });
        this.placePopup.setMap(this.map);

        Microsoft.Maps.Events.addHandler(this.placePopup, 'click', function (e) {
            var place = e.target.place;
            if (place) {
                go(place.id, false);
            }
        });
    }
    openPlacePopup(position, title, shorttext, place) {
        this.placePopup.setOptions({
            location: position,
            description: shorttext,
            title: title,
            visible: true
        });
    }
    closePopup() {
        this.placePopup.setOptions({ visible: false });
    }
    makePosition(lat, lng) { 
        return new Microsoft.Maps.Location(lat, lng); 
    }
    makePin(place) {
        if (place.cf.length > 0) {
            window.orderedList.push(place);
            if (place.text.length > 100) { window.interesting.push(place); }
            var options = this.pinOptions(place);
            var pushpin = new Microsoft.Maps.Pushpin(
                place.location,
                options
            );
            this.map.entities.push(pushpin);
            pushpin.myColor = options.color;
            pushpin.id = place.id;
            pushpin.place = place;
            place.pin = pushpin;
            // If this is a big icon for a whole town:
            if (place.principal && place.principal > 0) {

                //Create an infobox to use as a tooltip when hovering.
                pushpin.tooltip = new Microsoft.Maps.Infobox(this.map.getCenter(), {
                    visible: false,
                    showCloseButton: false,
                    offset: new Microsoft.Maps.Point(-75, 30),
                    description: "Click to see places here",
                    maxWidth: 400,
                    showPointer: true
                });
                pushpin.tooltip.setMap(this.map);

                Microsoft.Maps.Events.addHandler(pushpin, 'click', function (e) {
                    e.primitive.tooltip.setOptions({ visible: false });
                    var place = e.primitive.place;
                    delete window.location.queryParameters.place;
                    setZoneChoice(zoneFromPrincipal(place));
                    setCookie("mapCenter", "" + place.location.latitude + "," + place.location.longitude);
                    this.map.setView({ center: place.location });
                });

                Microsoft.Maps.Events.addHandler(pushpin, 'mouseover', function (e) {
                    e.primitive.tooltip.setOptions({
                        location: e.target.getLocation(),
                        visible: true
                    });
                });
                Microsoft.Maps.Events.addHandler(pushpin, 'mouseout', function (e) {
                    e.primitive.tooltip.setOptions({ visible: false });
                });

            } else { // Ordinary place
                if (!window.noHistory) {
                    Microsoft.Maps.Events.addHandler(pushpin, 'click', function (e) {
                        if (e) {
                            go(e.primitive.place.id, false);
                        }
                    });
                    Microsoft.Maps.Events.addHandler(pushpin, 'mouseover', function (e) {
                        window.map.openPlacePopup(e.target.getLocation(), place.title, popupText(e.primitive.place), place);
                    });
                    Microsoft.Maps.Events.addHandler(pushpin, 'mouseout', function (e) {
                        window.map.placePopup.setOptions({ visible: false });
                    });
                }
            }
        }

    }
    pinOptions(place) {
        if (place.principal && place.principal > 0) {
            // Represents a town whose places aren't currently in the displayed area
            return {
                title: "",
                text: place.title.replace(/&#39;/, "'").replace(/&quot;/, "\""),
                icon: principalPinTemplate
            };
        }

        var postcodeLetter = !window.noHistory && place.year
            ? ("" + place.year).substr(1, 2)
            : place.postcode ? place.postcode.substr(-1, 1) : "";

        // Principal < 0 is a town pin whose places are in the displayed area.
        // Otherwise, pin colour indicates whether there's much to read.
        var thisPinColor = place.principal ? "blue" : place.text.length > 100 ? "#FF0000" : "#A00000";
        return {
            title: place.title.replace(/&#39;/, "'").replace(/&quot;/, "\""),
            text: postcodeLetter, subTitle: place.subtitle, color: thisPinColor, enableHoverStyle: true
        };
    }

    setPin(pin, place) {
        var options = this.pinOptions(place);
        pin.setOptions(options);
        pin.setLocation(newPlace.location);
    }

    showPlace(place, zoom, shiftOffCentre) {
        if (zoom) {
            // Don't change the zoom level if it would change the map type:
            var isOS = this.map.getMapTypeId() == "os";
            var newzoom = isOS && zoom > 17 ? 17 : zoom;

            this.map.setView({ zoom: newzoom });
        }
        // Move place into view:    
        var yOffset = window.noHistory ? 0 : 0 - window.innerHeight / 4;

        this.map.setView({
            center: place.location,
            centerOffset: shiftOffCentre ? { x: 20 /*window.innerWidth/4*/, y: yOffset } : null
        });
    }

    // OS Landranger Map only goes up to zoom 17. Above that, display OS Standard.
    setStreetOsLayer() {
        if (this.map.getZoom() > 17 && this.map.getMapTypeId() == "os") {
            if (!this.streetOSLayer) {
                this.streetOSLayer = new Microsoft.Maps.TileLayer({
                    mercator: new Microsoft.Maps.TileSource({
                        uriConstructor: 'https://api.maptiler.com/maps/uk-openzoomstack-outdoor/256/{zoom}/{x}/{y}.png?key=' + window.keys.Client_OS_K
                    })
                });
                map.layers.insert(this.streetOSLayer);
            }
            else this.streetOSLayer.setVisible(1);
        }
        else { if (this.streetOSLayer) this.streetOSLayer.setVisible(0); }
    }


    // User selected a map type - OS or aerial photo.
    mapChange(v) {
        if (!this.map) return;
        if (v == "os") {
            this.map.setView({ mapTypeId: Microsoft.Maps.MapTypeId.ordnanceSurvey });
        }
        else {
            this.map.setView({ mapTypeId: Microsoft.Maps.MapTypeId.aerial });
        }
        this.setStreetOsLayer();
    }


    // Highlight place on map.

    // fromList : user chose place from the left-side index, not the map
    highlightPin(pin) {
        // Clear current highlight:
        if (this.selectedPin != null) {
            // myColor is an additional property we added to keep the default colour of each pin:
            this.selectedPin.setOptions({ color: this.selectedPin.myColor, enableClickedStyle: false });
        }
        this.selectedPin = pin;
        if (pin) pin.setOptions({ color: Microsoft.Maps.Color.fromHex('#FF00F0') });
    }

    clear() {
        this.map.entities.clear();
    }


}