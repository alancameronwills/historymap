// Code for main page of History Map.

window.pinColor = "#A00000";

// Reload with https unless testing locally.
if (window.location.protocol == "http:" && window.location.hostname != "localhost") {
    window.location = window.location.href.replace("http:", "https:");
}


// Initialization on document loaded:
$(function() {
    window.noHistory = window.location.queryParameters.history == "0";
    if (window.noHistory) {
        // Map is just for identifying places. No text or photos.
        $("#helpButton").hide();
        $("#historyTitle").text("Places");
    }

    // Initialize zone selection UI
    $("#zoneSelect")[0].action = updateZoneChoice;
    $(".dropdown").hover(
        function () { $(this).children(".dropDownMenu").css("display", "block"); },
        function () { $(this).children(".dropDownMenu").css("display", "none")[0].action(); }
    );
});

// On map API has completed loading
function loadMap() {
    $(function () {
        var mapCenter = new Microsoft.Maps.Location(52.068287, -4.747708);
        var centerFromCookie = getCookie("mapCenter");
        if (centerFromCookie) {
            mapCenter = Microsoft.Maps.Location.parseLatLong(centerFromCookie) || mapCenter;
        }
        window.map = new Microsoft.Maps.Map(document.getElementById('theMap'),
            {
                mapTypeId: Microsoft.Maps.MapTypeId.aerial,
                center: mapCenter,
                showLocateMeButton: false,
                disableKeyboardInput: true,
                zoom: 16
            });
        setUpMapClick();
        if (!window.noHistory) {
            setUpMapMenu();
        }

        // Detrmine which zone we're looking at and display the points
        var zoneChoice = getZoneChoiceFromCookie() || "moylgrove";
        window.zoneSelection = zoneChoice;
        showZoneChoiceOnUI(zoneChoice);
        displayZone(zoneChoice);
    });
}


// Display the map pins and side index for the selected zones.
function displayZone(zoneChoice) {
    // First clear the existing content:
    clearMapSelection();
    window.items = {};
    window.map.entities.clear();
    window.interesting = [];
    window.orderedList = [];

    $("#houselist").html("<p>Getting places...</p>");

    // Download from server:
    var fetchApi = apiUrl + "places?z=" + zoneChoice.replace(/ /g, '+');

    if (typeof fetch === 'undefined') {
        appInsights.trackEvent("load", { noHistory: window.noHistory, fetch: "true" }, {});
        fetch(fetchApi)
            .then(function (response) { return response.json(); })
            .then(gotTable) // Async
            .catch(function (err) {
                window.alert("Sorry - problem getting the map data. Please tell alan@pantywylan.org");
            });
    } else {
        appInsights.trackEvent("load", { noHistory: window.noHistory, fetch: "false" }, {});
        $.get(fetchApi, function (data, status) {
            gotTable(data);
        });
    }
    window.loadedTime = new Date().getTime();
}


// List of places in the selected zones has arrived.
function gotTable(results) {
    if (results == null) return;
    window.orderedList = [];
    window.interesting = [];
    for (var i = 0, t; t = results[i]; i++) {
        if (!t.Title) continue; // index or other housekeeping
        try {
            var place = makePlace(t);
            // For lookup by id:
            window.items[place.id] = place;
            makePin(place);
        } catch (error) { }
    }
    showPlaceList();

    // NoHistory is a queryparameter set if we're just showing a map of house names.
    if (!window.noHistory) {
        // Census and gravestone data currently only available for Moylgrove.            
        $("#searchPanel")[0].style.visibility = 
            (window.zoneSelection.indexOf("moylgrove")>=0) ? "visible" : "hidden";
    }

    if (window.location.queryParameters.place) {
        go(window.location.queryParameters.place, true);
    }

}


// Highlight place on map.
// place == null to just clear the selection
// fromList : user chose place from the left-side index, not the map
function selectOnMap(place, fromList) {
    // Clear current highlight:
    if (window.selectedPin != null) {
        // myColor is an additional property we added to keep the default colour of each pin:
        window.selectedPin.setOptions({ color: window.selectedPin.myColor, enableClickedStyle: false });
    }

    if (place == null) {
        window.selectedPin = null;
    }
    else {
        window.selectedPin = place.pin;
        //window.pinColor = place.pin.getColor();
        place.pin.setOptions({ color: Microsoft.Maps.Color.fromHex('#FF00F0') });
        setCookie("mapCenter", "" + place.location.latitude + "," + place.location.longitude);
        if (fromList) {
            // Don't change the zoom level if it would change the map type:
            var currentZoom = window.map.getZoom();
            var isOS = window.map.getMapTypeId() == "os";
            var zoom = proximity(place);
            var newzoom = isOS && zoom > 17 ? 17 : zoom;

            // Move place into view:
            window.map.setView({ zoom: newzoom });
            window.map.setView({ center: place.location, centerOffset: { x: 20 /*window.innerWidth/4*/, y: 0 - window.innerHeight / 4 } });
        }
    }
}

var latKm = 0.000089; // Pembs. 
var longKm = 0.000144;

function proximity(place) {
    var min = 1000000;
    window.orderedList.forEach(function (otherPlace) {
        if (otherPlace === place) return false;
        var dlat = (place.location.latitude-otherPlace.location.latitude)/latKm;
        var dlon = (place.location.longitude - otherPlace.location.longitude)/longKm;
        var product = dlat*dlat + dlon*dlon;
        if (product < min) min= product;
    });
    return min<16 ? 19 : min < 50 ? 17 : 16;
}



// Display the upper picture, which can be a streetview.
// If streetview, the url is abbreviated from the Google URL.
function showStreetView(picUrl) {
    if (picUrl && picUrl.length > 0) {
        var content = "";
        if (picUrl[0] == "!") {
            var ww = $("#textbox").width();
            // var maxh = $("#theMap").height() * 0.3;
            var hh = Math.round(ww * 0.75);
            content = "<iframe src='https://www.google.com/maps/embed?pb={0}' id='streetview' class='getpointer' width='{1}px' height='{2}px' frameborder='0' style='border:0' allowfullscreen></iframe>".format(picUrl, ww, hh);
        }
        else {
            var picBlob = picUrl.replace(/^images\//, imgUrl);
            content = "<a  class='getpointer' target='_new' href='{0}'><img src='{0}' style='max-width:40vw;height:auto;max-height:50vh;border-radius:6px;'></img></a>".format(picBlob);
        }
        $("#firstpic").html(content);
        $("#firstpic").fadeIn("slow");
    } else {
        $("#firstpic").slideUp("slow");
    }
}

// Display the second picture, which can be a slide show.
// If slide show, the URLs are separated by semicolons.
function showSlides(picUrlstring) {
    if (picUrlstring && picUrlstring.length > 0) {
        var urls = picUrlstring.split(";");

        var content = "";
        if (urls.length > 1) {
            for (var i in urls) {
                var picBlob = urls[i].replace(/^images\//, imgUrl);
                content += "<div class='slide'><a target='pic' href='{0}'><img src='{0}' class='slideimg'></img></a></div>".format(picBlob);
            }
            $("#secondpic").html(content);
            $("#secondpic").slideDown();
            $('#secondpic div:first').show();
            if (window.fader) { clearInterval(window.fader); }
            window.fader = setInterval(function () {
                var pic = $('#secondpic div:first');
                pic
                    .fadeOut(500)
                    .next()
                    .fadeIn(500)
                    .end()
                    .appendTo('#secondpic');
            }, 6000);
        }
        else {
            if (window.fader) { clearInterval(window.fader); window.fader = null; }
            var picBlob = picUrlstring.replace(/^images\//, imgUrl);
            content = "<a target='pic' href='{0}'><img src='{0}' class='slideimg'></img></a>".format(picBlob);
            $("#secondpic").html(content);
            $("#secondpic").slideDown();
        }
    }
    else {
        $("#secondpic").slideUp("slow");
        if (window.fader) { clearInterval(window.fader); window.fader = null; }
    }
}

function showLink(id) {
    var url = window.location.origin + window.location.pathname + "?place=" + id;
    $("#message").html("To show someone else this place, copy and send them this link:<br/>"
        + "<input id='msgbox' type='text' value='{0}' size={1} readonly></input>".format(url, url.length + 2));
    $("#message").show();
    $("#msgbox")[0].setSelectionRange(0, url.length);
    $("#msgbox")[0].focus();
    appInsights.trackEvent("showLink ");
}

function editPlace(id, title) {
    if (typeof fetch !== 'undefined') {
        window.open("editor.htm?id=" + id, target = "edit");
        appInsights.trackEvent("edit", { admin: "1" }, {});
    }
    else {
        window.open("mailto:alan@pantywylan.org?subject=change {0} {1}".format(id, title));
        appInsights.trackEvent("edit", { admin: "0" }, {});
    }
}

function showMainText(id, place) {
    var description = (("<table width='100%'><tr><td class='texthead'>{1}</td><td align='right'>{2}</td></tr>"
        + "<tr><td><small>{3}</small></td><td align='right'><small>{4}</small></td></tr></table>"
        + "<span class='description'>{0}</span>")
        .format(trimQuotes(place.text), place.title.replace("'", ""), place.postcode, place.subtitle, place.year)
        +
        (window.location.queryParameters.noedit != null ? "" :
            "<table width='100%' class='buttons'><tr>"
            + "<td><a href='#' onclick='editPlace(\"{0}\",\"{1}\")'>{4}</a></td>"
            + "<td align='center'><a href='#' onclick='showLink(\"{0}\")'>Share</a></td>"
            + "<td align='right'><a href='mailto:?subject=Directions&body=Click this link for directions:%0A https://www.google.co.uk/maps/dir//{2},{3}/@{2},{3},11z '>Send directions</a></td></tr></table>")
            .format(id, place.title.replace("'", ""), place.location.latitude, place.location.longitude, "Edit"));
    description = description.replace(/{{/, "<article src='").replace(/}}/, "'/>");
    $("#textbox").html(description);
    $("#textbox").fadeIn("slow");
    $("article").each(function (i) { getBlog($(this).attr("src")); });
}

function getBlog(url) {
    var geturl = url.replace("http://", "https://moylgrove-history.azurewebsites.net/api/fetch?code=wk50OFyaS7UzdnIPuIlePvMI6HdRUgbayS8lB8VyUyRjPizJyIEb7Q==&src=");
    $("#blog").fadeIn().children("iframe").attr("src", geturl);
}

function search(table, first, last, year, place, process) {
    if (typeof fetch !== 'undefined') {
        fetch(apiUrl + "{0}?first={1}&last={2}&year={3}&place={4}"
            .format(table, first || "", last || "", year || "", place || ""))
            .then(function (response) { return response.json(); })
            .then(function (results) { process(results); });
    }
    else {
        $.get(apiUrl + "{0}?first={1}&last={2}&year={3}&place={4}"
            .format(table, first || "", last || "", year || "", place || ""),
            function (data, status) {
                process(data);
            });
    }
    appInsights.trackEvent("search");
}

function searchPerson() {
    var gn = $('#searchName')[0].value.trim();
    var ln = $('#searchLastName')[0].value.trim();
    var syob = $('#searchYob')[0].value.trim();
    if (!gn && !ln && !syob) return;
    $('#searchResult').show(200);
    $("#searchCloseButton").css("background-color", "darkred");
    $('#searchResult').html("<table><tr><th>source</th><th>house</th><th>given</th><th>surname</th><th>b</th><th>origin</th></table>");
    search("census", gn, ln, syob, "", function (results) {
        if (results.length > 0) {
            var s = "";
            for (var i = 0, t; t = results[i]; i++) {
                var origin = t.Origin; if (origin == "m") origin = "Moylg";
                s += "<tr><td>{0}cs</td><td><span {6} onclick='go({5},1)'>{1}</span></td><td>{2}</td><td>{3}</td><td>{4}</td><td>{7}</td></tr>"
                    .format(t.PartitionKey, t.HouseName, t.GivenNames, t.Surname, t.YoB, t.PlaceId,
                        t.PlaceId ? "class='darklink'" : "", origin);
            }
            $('#searchResult > table > tbody').append(s);
        }
    });
    search("graves", gn, ln, syob, "", function (results) {
        if (results.length > 0) {
            var s = "";
            for (var i = 0, t; t = results[i]; i++) {
                s += "<tr><td>grave</td><td><span {6} onclick='go({5},1)'>{0}</span></td><td>{1}</td><td>{2}</td><td>{3}</td><td>- {4}</td></tr>"
                    .format(t.home, t.firstNames, t.lastName, t.yob, t.yod, t.assigned,
                        t.assigned ? "class='darklink'" : "");
            }
            $('#searchResult > table > tbody').append(s);
        }
    });
}

function startSearch(firsts, last, yob) {
    appInsights.trackEvent("clickPerson");
    var first = firsts.split(" ")[0];
    $('#searchName')[0].value = first;
    $('#searchLastName')[0].value = last;
    $('#searchYob')[0].value = yob;
    searchPerson();
}


function getPeopleData(id, houseName) {
    if (!id) return;
    var censusYears = {};
    search("census", "", "", "", id, function (result) {
        if (result.length > 0) {
            var showHouseName = false;
            var cf = comparable(houseName);
            for (var i = 0, t; t = result[i]; i++) {
                if (t.HouseName && comparable(t.HouseName) != cf) { showHouseName = true; }
                if (!censusYears[t.PartitionKey]) { censusYears[t.PartitionKey] = []; }
                censusYears[t.PartitionKey].push(t);
            }
            $("#textbox").append("<h4><a href='#' onclick=\"$('#census').toggle('slide')\">Census entries</a></h4>");
            var householdName = "";
            var s = "<table>";
            for (var cy in censusYears) {
                var yearEntries = censusYears[cy];
                s += "<tr><td colspan=5><b>{0}</b></td></tr>".format(cy);
                for (var i = 0, t; t = yearEntries[i]; i++) {
                    if (showHouseName && t.HouseName != householdName) {
                        householdName = t.HouseName;
                        s += "<tr><td colspan=5><i>{0}</i></td></tr>".format(householdName);
                    }
                    s += "<tr><td><span class='link' onclick='startSearch(\"{0}\", \"{1}\", \"{2}\")'>{0} {1}</span></td><td>{2}</td><td>{3}</td><td>{4}</td><td>{5}</td><td>{6}</td></tr>".format(
                        t.GivenNames, t.Surname, t.YoB.substr(0, 4), t.Age,
                        decode({ h: "head", sole: "head", w: "wife", s: "son", d: "dgtr", b: "bro" }, t.Relationship || ""),
                        decode({ s: "sgl", m: "mrd", u: "unm", w: "wdw", d: "div" }, t.Condition || ""), t.Occupation || "");
                }
            }
            s += "</table>";
            $("#textbox").append(s);
        }
    });
}
function decode(m, code) {
    var d = m[code];
    return d ? d : code;
}

function getGraves(id) {
    if (!id) return;
    search("graves", "", "", "", id, function (result) {
        if (result.length > 0) {
            result.sort(function (a, b) { return a.yod - b.yod; });
            var s = "<h4><a href='https://drive.google.com/file/d/1LjXR1C27fwazM0Ovib4oKRdfxY47TAcc/view' target='graves'>Gravestones</a></h4>"
                + "<table>";
            for (var i = 0, t; t = result[i]; i++) {
                s += ("<tr><td>{0}</td><td>-{1}</td><td><span class='link' onclick='startSearch(\"{2}\", \"{3}\", \"{0}\")'>{2}</span></td>"
                    + "<td><span class='link' onclick='startSearch(\"{2}\", \"{3}\", \"{0}\")'>{3}</span></td><td>{4}</td><td>{5}</td><td>{6}</td></tr>").format(
                        t.yob, t.yod, t.firstNames, t.lastName, t.age, t.home, t.graveId);
            }
            s += "</table>";
            $("#textbox").append(s);
        }
    });
}

function listAudio() {
    $.get("https://moylgrovehistory.blob.core.windows.net/audiovis?restype=container&comp=list", function (data, status) {
        var nameElements = data.getElementsByTagName("Name");
        window.avlist = $.makeArray(nameElements).map(function (x) { return x.textContent.replace(".mp3", ""); });
    });
}

function getAudio(id) {
    if (!id) return;
    $("#audiodiv").hide();
    try {
        if (window.avlist.includes(id)) {
            try {
                $("#audiodiv").html("<audio controls><source src='{0}{1}.mp3' type='audio/mpeg'></source></audio><br/>Commentary &copy; Sally James".format(avUrl, id));
                $("#audiodiv").show();
            } catch (ex) { }
        };
    } catch (exx) {
        var exxx = exx;
    }
}
listAudio();

function DeletePlace(id) {
    $("#message").hide();
    $("#census").hide();
    $("#deleteDialog")[0].place = id;
    $("#deleteDialog").show();
    appInsights.trackEvent("delete", { place: id }, {});
}

function DeleteConfirmed(id) {
    $.ajax({
        url: apiUrl + 'remove?code=U38IwtWc7nxEpwdGjVwVAdLH/Y5evmuX3JZAxQiAwXSpkx48utDyMg==',
        type: 'PUT',
        data: '{ "RowKey" : "' + id + '"}',
        contentType: 'application/json',
        success: function (a, e, r) {
            window.open(location.origin + location.pathname, "_self");
        }
    }
    );
}

var doingRetry = null;

// We're trying to jump to a place that isn't in the current index.
// Probably because it's outside the currently selected zone.
// Find out where it is and extend the zone selection to include it.
function retryZone(id, includePrevious) {
    if (doingRetry == id) {
        // Avoid retry loop.
        return;
    }
    doingRetry = id;
    // Retrieve place from server:
    $.get(apiUrl + "place?id="+id, function(data, status){
        if (data.length == 0) return;
        // A zone the place is in:
        var zone = data[0].HomeZone; 
        if (zone) {
            if (window.zoneSelection.indexOf(zone) < 0)
            {
                setZoneChoice((includePrevious ? window.zoneSelection + " " : "") + zone);
            }
        }
    });

}

// On user clicks a place
function go(id, fromList) {
    $("#message").hide();
    $("#blog").fadeOut();
    var place = window.items[id];
    if (!place) {
        // Not in current index probably because it's outside the currently selected zone.
        retryZone(id, true);
        return;
    }
    if (place.principal && place.principal>0) {
        retryZone(id, false);
        return;
    }
    doingRetry = null;
    selectOnList(id, fromList);
    selectOnMap(place, fromList);
    if (!window.noHistory) {
        showMainText(id, place);
        showStreetView(place.pic1);
        showSlides(place.pic2);
        getPeopleData(id, place.title);
        getGraves(id);
        getAudio(id);
    }

    // Monitor user behaviour: How long after opening map places are opened.
    var t = 0;
    if (window.loadedTime) {
        var tnow = new Date().getTime();
        t = tnow - window.loadedTime;
    }
    appInsights.trackEvent("place", { place: id }, { t: t });
}

function setUpMapMenu() {
    window.menuBox = new Microsoft.Maps.Infobox(
        window.map.getCenter(),
        {
            visible: false,
            showPointer: true,
            offset: new Microsoft.Maps.Point(0, 0),
            actions: [
                {
                    label: "Add place here  .",
                    eventHandler: function () {
                        var loc = window.menuBox.getLocation();
                        window.menuBox.setOptions({ visible: false });
                        window.open("editor.htm?cmd=add&lat={0}&long={1}".format(loc.latitude, loc.longitude), "_blank");
                    }
                }
            ]
        });
    window.menuBox.setMap(window.map);
    Microsoft.Maps.Events.addHandler(window.map, "rightclick",
        function (e) {
            window.menuBox.setOptions({
                location: e.location,
                visible: true
            });
        });
}

function setUpMapClick() {
    Microsoft.Maps.Events.addHandler(window.map, "click", function (e) {
        clearMapSelection();
    });
}

function clearMapSelection() {
    if ($("#message").is(":visible")) {
        $("#message").fadeOut();
    }
    else {
        $("#textbox").fadeOut();
        $("#audiodiv").hide();
        $("#firstpic").fadeOut();
        $("#secondpic").fadeOut();
        $("#message").fadeOut();
        $("#census").fadeOut();
        $("#blog").fadeOut().children("iframe").attr("src", null);
        selectOnMap(null, false);
        selectOnList(null, false);
        if (window.fader != null) { clearInterval(fader); window.fader = null; }
    }
    if (window.menuBox != null) { window.menuBox.setOptions({ visible: false }); }
}

window.addEventListener("beforeunload", function (e) {
    // Might have used this after editing a place
    if (localStorage) localStorage.clear();
});

// Called when the edit window has updated a place.
// It puts the item in local store as well as sending to server.
window.addEventListener("storage", function (event) {
    if (event.key == "place") {
        var newPlace = makePlace(JSON.parse(event.newValue));
        var oldPlace = window.items[newPlace.id];
        window.items[newPlace.id] = newPlace;
        if (oldPlace) {
            var i = window.orderedList.indexOf(oldPlace);
            if (i >= 0) window.orderedList[i] = newPlace;
            var j = window.interesting.indexOf(oldPlace);
            if (j >= 0) window.interesting[j] = newPlace;
            else if (newPlace.text.length > 1000) {
                window.interesting.push(newPlace);
            }
            var pushpin = oldPlace.pin;
            var options = pinOptions(newPlace);
            pushpin.setOptions(options);
            pushpin.setLocation(newPlace.location)
            pushpin.myColor = options.color;
            newPlace.pin = pushpin;
            if (newPlace.cf != oldPlace.cf) showPlaceList();
            go(newPlace.id, false);
        } else {
            window.location.assign("./?place=" + newPlace.id);
        }
    }
});

function makePlace(t) {
    var place = {
        title: trimQuotes(t.Title),
        subtitle: t.Subtitle,
        id: t.RowKey,
        postcode: "" + t.Postcode,
        location: new Microsoft.Maps.Location(t.Latitude, t.Longitude),
        zoom: t.Zoom == "1" ? 19 : 17,
        pic1: "" + t.Pic1,
        pic2: "" + t.Pic2,
        text: t.Text,
        year: "" + t.Year,
        principal: t.Principal,
        updated: new Date(t.Updated || "2010-01-01T00:00:00.000Z")
    };
    // For alphabetic sorting:
    place.cf = comparable(place.title);
    return place;
}

// Big marker for towns that aren't currently displayed:
var principalPinTemplate = ['<svg xmlns="http://www.w3.org/2000/svg" width="180" height="45">',
    '<rect x="0" y="0" width="180" height="45" rx="15" ry="15" fill="blue" />',
    '<text x="15" y="30" fill="white" font-family="sans-serif" font-size="24px">{text}</text>',
    '</svg>'].join("");

// Default colour, shape, and label of a pin:
function pinOptions(place) {
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
    var thisPinColor = place.principal ? "blue" : place.text.length > 300 ? "#FF0000" : "#A00000";
    return {
        title: place.title.replace(/&#39;/, "'").replace(/&quot;/, "\""),
        text: postcodeLetter, subTitle: place.subtitle, color: thisPinColor, enableHoverStyle: true
    };
}


function makePin(place) {
    if (place.cf.length > 0) {
        window.orderedList.push(place);
        if (place.text.length > 1000) { window.interesting.push(place); }
        var options = pinOptions(place);
        var pushpin = new Microsoft.Maps.Pushpin(
            place.location,
            options
        );
        window.map.entities.push(pushpin);
        pushpin.myColor = options.color;
        pushpin.id = place.id;
        pushpin.place = place;
        place.pin = pushpin;
        // If this is a big icon for a whole town:
        if (place.principal && place.principal > 0) {

            //Create an infobox to use as a tooltip when hovering.
            pushpin.tooltip = new Microsoft.Maps.Infobox(map.getCenter(), {
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
                window.map.setView({ center: place.location });
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
            }
        }
    }
}

// Title of principal must be ~= name of zone
function zoneFromPrincipal(place) {
    return place.title.toLocaleLowerCase().replace(/ /, "");
}

function showPlaceList() {
    window.orderedList = window.orderedList.sort(function (a, b) {
        return a.cf.localeCompare(b.cf);
    });
    window.interesting = window.interesting.sort(function (a, b) {
        return b.updated - a.updated;
    }).slice(0, 5);

    var listContent = "";
    for (var i in window.orderedList) {
        var item = window.orderedList[i];
        var isInteresting = !window.noHistory && $.inArray(item, window.interesting) >= 0;

        listContent += "<div id='h{0}' {2} onClick='go(\"{0}\",true)' title='\"{0}\"'>{1}</div>".format(item.id, item.title, (isInteresting ? "class='interesting'" : ""));
    }
    $("#houselist").html(listContent);
}

// User selected a map type - OS or aerial photo.
function mapChange(v) {
    if (v == "os") {
        if (window.map.getZoom() > 17) { // Zoom out to minimum for OS
            window.map.setView({ zoom: 17, mapTypeId: Microsoft.Maps.MapTypeId.ordnanceSurvey });
        }
        else {
            window.map.setView({ mapTypeId: Microsoft.Maps.MapTypeId.ordnanceSurvey });
        }
    }
    else {
        window.map.setView({ mapTypeId: Microsoft.Maps.MapTypeId.aerial });
    }
}

// From the drop-down menu.
function getZoneChoiceFromUI() {
    var selection = "";
    $("#zoneSelect").children("input").each(function (i, e) { if (e.checked) selection += " " + e.value; });
    return selection.trim();
}

// Set the drowpdown menu to reflect the current zone selection, obtained from a cookie.
function showZoneChoiceOnUI(zones) {
    if (zones) {
        $("#zone").html("<p>" + zones.replace(/ .*/, "...") + "</p>");
        $("#zoneSelect").children("input").each(function (i, e) {
            e.checked = (zones.indexOf(e.value) >= 0);
        });
    }
    else { $("#zone").html("<span style='background-color:red'>Choose...</span>"); }
}

function setZoneCookie(zones) {
    setCookie("zones", zones, 1000);
}

function getZoneChoiceFromCookie() {
    return getCookie("zones");
}


// Zone dropdown: User may have changed the zone selection
function updateZoneChoice() {
    var zoneChoice = getZoneChoiceFromUI();
    if (window.zoneSelection == zoneChoice) return;
    // Forget any previous navigation to a specific place:
    delete window.location.queryParameters.place;
    setZoneChoice(zoneChoice);
}

// Move to and display a different zone
function setZoneChoice(zoneChoice) {
    window.zoneSelection = zoneChoice;
    showZoneChoiceOnUI(zoneChoice);
    setZoneCookie(zoneChoice);
    displayZone(zoneChoice);
}


