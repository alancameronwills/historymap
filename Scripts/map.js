
// map.js version 8

/*
Google maps API is user pantywylan@gmail.com, project name moylegrove-f7u
*/

function x_insertScript(s) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.type = 'text/javascript';
    script.src = s;
    head.appendChild(script);
}

function insertScript(s, success) {
    $.ajax({
        url: s,
        dataType: "script",
        success: success,
        async: false
    });
}

function doLoadMap() {
    var savedCartography = getCookie("cartography");
    var queryCartography = window.location.queryParameters["cartography"]
        ? (window.location.queryParameters["cartography"] == "google" ? "google" : "bing")
        : null;
    if (queryCartography) {
        setCookie("cartography", queryCartography);
    }
    var cartography = queryCartography || savedCartography || "bing";

    window.map = cartography == "google" ? new GoogleMap() : new BingMap();
}


function mapModuleLoaded() {
    window.map.loaded(onMapLoaded || (() => { }));
}

class GoogleMap {
    constructor() {
        this.markers = new Array();
        insertScript('https://maps.googleapis.com/maps/api/js?key=' + window.keys.Client_Google_Map_K + '&callback=mapModuleLoaded');
    }
    mapCoords(latLongString) {
        let ll = latLongString.split(",");
        if (ll.length != 2) {
            ll = [52, -4];
        }
        return new google.maps.LatLng(ll[0], ll[1]);
    }
    loaded(onload) {
        $(() => {
            $("#mapTypeSelectorDiv").hide();
            var mapCenter = initMapCentre();
            this.map = new google.maps.Map(document.getElementById('theMap'),
                {
                    center: this.mapCoords(initMapCentre()),
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
            this.getMapType();
            this.map.addListener("maptypeid_changed", function () {
                window.map.getMapType();
                window.map.reDrawMarkers();
            });
            if (!window.noHistory) {
                this.setUpMapMenu();
                this.setUpPlacePopup();
            }
            onload();
        })
    }

    getMapType() {
        var t = this.map.getMapTypeId();
        this.mapType = t == google.maps.MapTypeId.SATELLITE || t == google.maps.MapTypeId.HYBRID ? "satellite" : "roadmap";
    }

    setUpMapMenu() {
        var menuString = "";
        for (var i = 0; i < rightClickActions.length; i++) {
            menuString += "<a href='#' onclick='rightClickActions[{1}].eventHandler()'>{0}</a>".format(rightClickActions[i].label, i);
            menuString += "<br/>";
        }
        this.menuBox = new google.maps.InfoWindow({
            content: menuString
        });
        this.map.addListener("rightclick", function (e) {
            // console.log("rightclick 1");
            window.map.menuBox.setPosition(e.latLng);
            window.map.menuBox.open(window.map.map);
        });
    }

    closeMapMenu() {
        if (this.menuBox) this.menuBox.close();
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
        return { latitude: lat, longitude: lng };
    }
    makePin(place, nopopup) {
        if (place.cf.length > 0) {
            // console.log("makePin " + place.title);
            var options = this.pinOptions(place);
            var pushpin = new google.maps.Marker(options);
            this.markers.push(pushpin);
            pushpin.myColor = options.icon.strokeColor;
            pushpin.id = place.id;
            pushpin.place = place;
            place.pin = pushpin;

            if (!nopopup) {
                pushpin.addListener("click", (e) => {
                    // console.log("pin click 1");
                    go(place.id, false);
                });
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
            return pushpin;
        }
    }
    removePin(place) {
        var i = this.markers.indexOf(place.pin);
        this.markers.splice(i, 1);
        place.pin.setMap(null);
        place.pin.place = null;
        place.pin = null;
    }

    reDrawMarkers() {
        for (var i = 0; i < this.markers.length; i++) {
            var pin = this.markers[i];
            pin.setOptions(this.pinOptions(pin.place));
        }
    }
    pinOptions(place) {
        var thisPinColor = place.principal ? "blue" : place.text.length > 100 ? "#FF0000" : "#A00000";
        var thisLabelColor = this.mapType == "satellite" ? "#FFE000" : "#806000";
        return {
            map: this.map,
            label: { color: thisLabelColor, fontWeight: "bold", text: place.title.replace(/&#39;/g, "'").replace(/&quot;/g, "\"") },
            position: new google.maps.LatLng(place.location.latitude, place.location.longitude),
            icon: { path: google.maps.SymbolPath.CIRCLE, strokeColor: thisPinColor, fillColor: "white", scale: 6, labelOrigin: { x: 0, y: 2.2 } }
        };
    }
    setPin(pin, place) {
        var options = this.pinOptions(place);
        pin.setOptions(options);
        pin.setPosition(new google.maps.LatLng(place.location.latitude, place.location.longitude));
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
            //this.selectedPin.getIcon().strokeColor = this.selectedPin.myColor;
            this.setPinColor(this.selectedPin, this.selectedPin.myColor);
        }
        this.selectedPin = pin;
        if (pin) {
            pin.myColor = pin.getIcon().strokeColor;
            //pin.getIcon().strokeColor = "#FF00F0";
            this.setPinColor(this.selectedPin, "#FF00F0");
        }
    }

    setPinColor(pin, color) {
        pin.setOptions({ icon: { path: google.maps.SymbolPath.CIRCLE, strokeColor: color, scale: 6, labelOrigin: { x: 0, y: 2 } } });
    }

    clear() {
        for (var i = 0; i < this.markers.length; i++) {
            this.markers[i].setMap(null);
        }
        this.markers = new Array();
    }

    getPinCenter() {
        if (!this.singlePin) return null;
        var position = this.singlePin.getPosition();
        return new Pin(position.lat(), position.lng());
    }

    moveSinglePin() {
        if (!this.singlePin) return null;
        var loc = this.menuBox.getPosition();
        this.singlePin.setPosition(loc);
        return loc;
    }

    recenter() {
        this.map.setCenter(this.singlePin.position);
    }
}

class Pin {
    constructor(lat, lng) { this.latitude = lat; this.longitude = lng; }
}

class BingMap {
    // https://learn.microsoft.com/en-us/azure/azure-maps/
    constructor() {
        insertScript('https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js', mapModuleLoaded);
    }
    loaded(onload) {
        var mapCenter = [-4.747708, 52.068287];
        var centerFromCookie = getCookie("mapCenter");
        if (centerFromCookie) {
            // Cookie is Lat,Long ; Azure Map is Long, Lat:
            let cookieLatLong = centerFromCookie.split(",");
            let lng = parseFloat(cookieLatLong[1]);
            let lat = parseFloat(cookieLatLong[0]);
            if (isFinite(lng) && isFinite(lat)) {
                mapCenter = [lng, lat];
            }
        }

        this.map = new atlas.Map('theMap',
            {
                style: 'satellite_with_roads',
                center: mapCenter,
                showLocateMeButton: false,
                disableKeyboardInput: true,
                zoom: 15,
                authOptions: {
                    authType: 'subscriptionKey',
                    subscriptionKey: window.keys.Client_Azure_Map_K
                }
            });

        this.map.events.add('ready', () => {
            this.map.controls.add(new atlas.control.ZoomControl(), { position: 'top-right' });
        });

        this.map.events.add("click", function (e) {
            clearMessageOrMapSelection();
        });

        if (!window.noHistory) {
            this.setUpMapMenu();
            this.setUpPlacePopup();
        }

        this.map.events.add('viewchangeend', () => window.map.setStreetOsLayer());
        onload();
    }


    setUpMapMenu() {
        var menuString = "";
        for (var i = 0; i < rightClickActions.length; i++) {
            menuString += "<a href='#' onclick='rightClickActions[{1}].eventHandler()'>{0}</a>".format(rightClickActions[i].label, i);
            menuString += "<br/>";
        }
        this.menuBox = new atlas.Popup({ closeButton: false, fillColor: 'white', content: menuString, position: [0, 0] });
        this.map.events.add("contextmenu", (e) => {
            this.menuBoxLocation = { latitude: e.position[1], longitude: e.position[0] };
            this.menuBox.setOptions({ position: e.position });
            this.menuBox.open(this.map);
        });
    }

    doAddPlace() {
        var loc = this.menuBoxLocation;
        this.menuBox.close();
        window.open("editor.htm?cmd=add&lat={0}&long={1}".format(loc.latitude, loc.longitude), "_blank");
    }

    setUpPlacePopup() {
        this.placePopup = new atlas.Popup({ closeButton: false, position: [0, 0] });
    }

    openPlacePopup(position, title, shorttext, place) {
        this.placePopup._place = place;
        this.placePopup.setOptions({
            content: "<div onclick='go(window.map.placePopup._place.id, false)'><h3>" + title + "</h3>" + shorttext + "</div>",
            position: [position.longitude, position.latitude]
        });
        this.placePopup.open(this.map);
    }

    closePopup() {
        this.placePopup.close();
    }

    closeMapMenu() {
        if (this.menuBox) this.menuBox.close();
    }

    makePosition(lat, lng) {
        var latitude = parseFloat(lat);
        var longitude = parseFloat(lng);
        return {
            latitude: isFinite(latitude) ? latitude : null,
            longitude: isFinite(longitude) ? longitude : null
        };
    }

    makePin(place, nopopup) {
        if (place.cf.length > 0) {
            if (place.location.longitude == null || place.location.latitude == null) return;
            var options = this.pinOptions(place);
            var marker;
            if (place.principal && place.principal > 0) {
                var svg = this.principalPinTemplate().replace('{text}', options.text);
                marker = new atlas.HtmlMarker({
                    position: [place.location.longitude, place.location.latitude],
                    htmlContent: svg,
                    anchor: 'center',
                    pixelOffset: [0, 0]
                });
            } else {
                marker = new atlas.HtmlMarker({
                    position: [place.location.longitude, place.location.latitude],
                    color: options.color,
                    text: options.text,
                    pixelOffset: [0, 0]
                });
            }
            this.map.markers.add(marker);
            marker.myColor = options.color;
            marker.id = place.id;
            marker.place = place;
            place.pin = marker;
            if (!nopopup) {
                // If this is a big icon for a whole town:
                if (place.principal && place.principal > 0) {
                    marker.tooltip = new atlas.Popup({
                        closeButton: false,
                        content: "<div>Click to see places here</div>",
                        position: [place.location.longitude, place.location.latitude]
                    });

                    this.map.events.add('click', marker, (function (m) {
                        return function () {
                            m.tooltip.close();
                            var p = m.place;
                            delete window.location.queryParameters.place;
                            setZoneChoice(zoneFromPrincipal(p));
                            setCookie("mapCenter", "" + p.location.latitude + "," + p.location.longitude);
                            window.map.map.setCamera({ center: [p.location.longitude, p.location.latitude] });
                        };
                    })(marker));

                    this.map.events.add('mouseover', marker, (function (m) {
                        return function () {
                            var pos = m.getOptions().position;
                            m.tooltip.setOptions({ position: pos });
                            m.tooltip.open(window.map.map);
                        };
                    })(marker));

                    this.map.events.add('mouseout', marker, (function (m) {
                        return function () {
                            m.tooltip.close();
                        };
                    })(marker));

                } else { // Ordinary place
                    this.map.events.add('click', marker, (function (m) {
                        return function () {
                            go(m.place.id, false);
                        };
                    })(marker));

                    this.map.events.add('mouseover', marker, (function (m) {
                        return function () {
                            var pos = m.getOptions().position;
                            var position = { latitude: pos[1], longitude: pos[0] };
                            window.map.openPlacePopup(position, m.place.title, popupText(m.place), m.place);
                        };
                    })(marker));

                    this.map.events.add('mouseout', marker, function () {
                        window.map.closePopup();
                    });
                }
            }
            return marker;
        }
    }


    removePin(place) {
        this.map.markers.remove(place.pin);
        place.pin.place = null;
        place.pin = null;
    }

    // Big marker for towns that aren't currently displayed:
    principalPinTemplate() {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="25">'
            + '<rect x="0" y="0" width="100" height="25" rx="7" ry="7" fill="blue" />'
            + '<text x="7" y="15" fill="white" font-family="sans-serif" font-size="12px">{text}</text>'
            + '</svg>';
    }

    pinOptions(place) {
        if (place.principal && place.principal > 0) {
            // Represents a town whose places aren't currently in the displayed area
            return {
                title: "",
                text: place.title.replace(/&#39;/, "'").replace(/&quot;/, "\""),
                icon: this.principalPinTemplate()
            };
        }

        var postcodeLetter = !window.noHistory && place.year
            ? ("" + place.year).substr(1, 2)
            : place.postcode ? place.postcode.substr(-1, 1) : "";

        // Principal < 0 is a town pin whose places are in the displayed area.
        // Otherwise, pin colour indicates whether there's much to read.
        var thisPinColor = place.principal ? "blue" : place.text.length > 100 ? "#FF0000" : "#A00000";
        if (place.place2) {
            let health = place.place2.health;
            thisPinColor = pinColor2(health);
        }
        return {
            title: place.title.replace(/&#39;/, "'").replace(/&quot;/, "\""),
            text: postcodeLetter,
            subTitle: (place.place2 ? place.place2.Owner : place.subtitle),
            color: thisPinColor,
            enableHoverStyle: true
        };
    }

    setPin(pin, place) {
        var options = this.pinOptions(place);
        pin.setOptions({ color: options.color, text: options.text, position: [place.location.longitude, place.location.latitude] });
    }


    showPlace(place, zoom, shiftOffCentre) {
        if (place.location.longitude == null || place.location.latitude == null) return;
        var cameraOpts = { center: [place.location.longitude, place.location.latitude] };
        if (zoom) {
            // Don't change the zoom level if it would change the map type:
            cameraOpts.zoom = this.isOsMode && zoom > 17 ? 17 : zoom;
        }
        this.map.setCamera(cameraOpts);
    }

    // OS Landranger Map only goes up to zoom 17. Above that, display OS Standard.
    setStreetOsLayer() {
        if (this.map.getCamera().zoom > 17 && this.isOsMode) {
            if (!this.streetOSLayer) {
                this.streetOSLayer = new atlas.layer.TileLayer({
                    tileUrl: 'https://api.maptiler.com/maps/uk-openzoomstack-outdoor/256/{z}/{x}/{y}.png?key=' + window.keys.Client_OS_K,
                    tileSize: 256
                });
                this.map.layers.add(this.streetOSLayer);
            }
            else this.streetOSLayer.setOptions({ visible: true });
        }
        else { if (this.streetOSLayer) this.streetOSLayer.setOptions({ visible: false }); }
    }


    // User selected a map type - OS or aerial photo.
    mapChange(v) {
        if (!this.map) return;
        if (v == "os") {
            this.isOsMode = true;
            this.map.setStyle({ style: 'road' });
        }
        else {
            this.isOsMode = false;
            this.map.setStyle({ style: 'satellite' });
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
        if (pin) pin.setOptions({ color: '#FF00F0' });
    }

    clear() {
        this.map.markers.clear();
    }

    setPinTitle(pin, title) {
        pin.setOptions({ title: title });
    }


    getPinCenter() {
        if (!this.singlePin) return null;
        var pos = this.singlePin.getOptions().position;
        return { latitude: pos[1], longitude: pos[0] };
    }

    moveSinglePin() {
        if (!this.singlePin) return null;
        var loc = this.menuBoxLocation;
        this.singlePin.setOptions({ position: [loc.longitude, loc.latitude] });
        return loc;
    }

    recenter() {
        this.map.setCamera({ center: this.singlePin.getOptions().position });
    }
}