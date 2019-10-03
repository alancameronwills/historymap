
function insertScript(s) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.type = 'text/javascript';
    script.src = s;
    head.appendChild(script);
}

function loadMap(mapType) {
    window.map = mapType == "google" @new GoogleMap() : new BingMap();
}
function mapModuleLoaded() {
    window.map.loaded();
}

class GoogleMap {
    constructor() {
        insertScript('https://maps.googleapis.com/maps/api/js?key=' + window.keys.Client_Google_Map_K + '&callback=mapModuleLoaded');
    }
    loaded() {
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
                clearMessageOrMapSelection();
            });
            if (!window.noHistory) {
                this.setUpMapMenu();
                setUpPlacePopupGoogle();
            }
        })
    }
    setUpMapMenu() {
        this.menuBox = new google.maps.InfoWindow({
            content: "<button onclick='doAddPlace()'>Add place here</button>"
        });
        this.map.addListener("rightclick", function (e) {
            this.menuBox.setPosition(e.latLng);
            this.menuBox.open(this.map);
        });
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
    closePopup () {
        this.placePopup.close();
    }
    makePin(place) {
        if (place.cf.length > 0) {
            window.orderedList.push(place);
            if (place.text.length > 100) { window.interesting.push(place); }
            var options = this.pinOptions(place);
            var pushpin = new google.maps.Marker(options);
            pushpin.myColor = options.icon.strokeColor;
            pushpin.id = place.id;
            pushpin.place = place;
            place.pin = pushpin;
    
            pushpin.addListener("click", (e) => {
                go(place.id, false);
            });
            
            if (!window.noHistory) {
    
                pushpin.addListener('mouseover', function (e) {
                    this.openPlacePopup(pushpin.getPosition(), place.title, popupText(place), place);
                });
                pushpin.addListener('mouseout', function (e) {
                    this.placePopup.close();
                });
            }
            pushpin.setMap(this.map);
        }
    }
    pinOptionsGoogle(place) {
        var thisPinColor = place.principal ? "blue" : place.text.length > 100 ? "#FF0000" : "#A00000";
        return {
            map: window.map,
            label: place.title.replace(/&#39;/, "'").replace(/&quot;/, "\""),
            position: new google.maps.LatLng(place.location.latitude, place.location.longitude),
            icon: { path: google.maps.SymbolPath.CIRCLE, strokeColor: thisPinColor, fillColor: "white", scale: 6 }
        };
    }
    showPlace (place, zoom) {
        this.map.panTo(new google.maps.LatLng(place.location.latitude, place.location.longitude));
        this.map.setZoom(zoom);
    }   
}

class BingMap {
    constructor() {
        insertScript('https://www.bing.com/api/maps/mapcontrol?key=' + window.keys.Client_Map_K + '&callback=mapModuleLoaded');
    }
    loaded() {
        $(() => {
            var mapCenter = new Microsoft.Maps.Location(52.068287, -4.747708);
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

            Microsoft.Maps.Events.addHandler(this.map, "click", function (e) {
                clearMessageOrMapSelection();
            });
            Microsoft.Maps.Events.addHandler(this.map, 'viewchangeend', setStreetOsLayer);
            if (!window.noHistory) {
                this.setUpMapMenu();
                this.setUpPlacePopup();
            }
        });
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
                            var loc = window.menuBox.getLocation();
                            this.menuBox.setOptions({ visible: false });
                            window.open("editor.htm?cmd=add&lat={0}&long={1}".format(loc.latitude, loc.longitude), "_blank");
                        }
                    }
                ]
            });
        this.menuBox.setMap(this.map);
        Microsoft.Maps.Events.addHandler(this.map, "rightclick",
            function (e) {
                this.menuBox.setOptions({
                    location: e.location,
                    visible: true
                });
            });
    }
    setUpPlacePopup() {
        //Create an infobox to show start of place text on hover
        this.placePopup = new Microsoft.Maps.Infobox(map.getCenter(), {
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
    openPlacePopup(position, title, content, place) {
        this.placePopup.setOptions({
            location: position,
            description: shorttext,
            title: place.title,
            visible: true
        });
    }
    closePopup () {
        this.placePopup.setOptions({ visible: false });
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
                pushpin.tooltip.setMap(map);
    
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
                        openPlacePopup(e.target.getLocation(), place.title, popupText(e.primitive.place), place);
                    });
                    Microsoft.Maps.Events.addHandler(pushpin, 'mouseout', function (e) {
                        this.placePopup.setOptions({ visible: false });
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
    
    showPlace (place, zoom) {
        // Don't change the zoom level if it would change the map type:
        var isOS = this.map.getMapTypeId() == "os";
        var newzoom = isOS && zoom > 17 ? 17 : zoom;

        // Move place into view:
        this.map.setView({ zoom: newzoom });
        var yOffset = window.noHistory ? 0 : 0 - window.innerHeight / 4;
        this.map.setView({ center: place.location, centerOffset: { x: 20 /*window.innerWidth/4*/, y: yOffset } });    
    }
}