// Code for main page of History Map.

// Reload with https unless testing locally.
if (window.location.protocol == "http:" && window.location.hostname != "localhost") {
    window.location = window.location.href.replace("http:", "https:");
}
var rightClickActions = [{ label: "Add place here", eventHandler: () => { window.map.doAddPlace(); } }];


window.pinColor = "#A00000";

// noHistory --> map is just for identifying places - no text, photos, search, etc
window.noHistory = window.location.queryParameters.history == "0";

// Initialization on document loaded:
$(function () {
    if (window.noHistory) {
        // Map is just for identifying places. No text or photos.
        $("#helpButton").hide();
        $("#historyTitle").text("Places");
    }
});




function initMapCentre() {
    return getCookie("mapCenter") || "52.068287,-4.747708";
}

function onMapLoaded() {
    var zoneChoice = getZoneChoiceFromCookie() || "moylgrove";
    window.zoneSelection = zoneChoice;
    showChoiceOnUI("#zone", zoneChoice);
    // Initialize zone selection UI
    $("#zoneSelect")[0].action = updateZoneChoice;
    $(".dropdown").hover(
        function () { $(this).children(".dropDownMenu").css("display", "block"); },
        function () { $(this).children(".dropDownMenu").css("display", "none")[0].action(); }
    );
    displayZone(zoneChoice);
    $("#mapStyleSelect")[0].action = updateMapStyle;    
}


// Display the map pins and side index for the selected zones.
function displayZone(zoneChoice) {
    // First clear the existing content:
    // console.log("displayZone 1");
    clearMapSelection();
    // console.log("displayZone 2");
    window.map.clear();

    // console.log("displayZone 3");

    window.items = {};

    $("#houselist").html("<p>Getting places...</p>");

    // Download from server:
    var fetchApi = apiUrl + "places?z=" + zoneChoice.replace(/ /g, '+');
    var fetchApi2 = apiUrl + "places02";

    if (typeof fetch != 'undefined') {
        appInsights.trackEvent("load", { noHistory: window.noHistory, fetch: "true" }, {});
        placeListsGot = 0;
        fetch(fetchApi)
            .then(function (response) { return response.json(); })
            .then(gotTable) // Async
            .catch(function (err) {
                window.alert("Sorry - problem getting the map data. Please tell alan@pantywylan.org");
            });
        if (place2AuthCheck()) {
            fetch(fetchApi2)
                .then(response => response.json())
                .then(gotTable2)
                .catch(err => { });
        }
    } else {
        appInsights.trackEvent("load", { noHistory: window.noHistory, fetch: "false" }, {});
        $.get(fetchApi, function (data, status) {
            gotTable(data);
        });
    }
    window.loadedTime = new Date().getTime();
}

function place2AuthCheck() {
    if (location.host == "localhost") return true;
    if (getCookie("privatedb")) return true;
    return false;
}

function gotTable2(results) {
    if (!results) return;
    window.places2 = {};
    for (var i = 0, t; t = results[i]; i++) {
        window.places2[t.RowKey] = t;
    }
    mergeTables();
}

var placeListsGot = 0;

/**
 * Merge public and private info.
 */
function mergeTables() {
    if (++placeListsGot >= 2) {
        for (var id in window.places2) {
            if (window.items[id]) {
                window.items[id].place2 = window.places2[id];
                let pin = window.items[id].pin;
                if (pin) {
                    let options = window.map.pinOptions(window.items[id]);
                    pin.myColor = options.color;
                    pin.setOptions(options);
                }
            }
        }
    }
}

// List of places in the selected zones has arrived.
function gotTable(results) {
    //console.log("gotTable 1");
    if (results == null) return;
    window.orderedList = [];
    window.interesting = [];
    for (var i = 0, t; t = results[i]; i++) {
        if (!t.Title) continue; // index or other housekeeping
        try {
            //console.log("gotTable " + t.Title);
            var place = makePlace(t);
            // For lookup by id:
            window.items[place.id] = place;
            window.orderedList.push(place);
            if (place.text.length > 100) { window.interesting.push(place); }
            window.map.makePin(place);
        } catch (error) { console.log(error); }
    }
    mergeTables();
    showPlaceList();

    // NoHistory is a queryparameter set if we're just showing a map of house names.
    if (!window.noHistory) {
        // Census and gravestone data currently only available for Moylgrove.            
        $("#searchPanel")[0].style.visibility =
            (window.zoneSelection.indexOf("moylgrove") >= 0) ? "visible" : "hidden";
    }

    if (window.location.queryParameters.place) {
        go(window.location.queryParameters.place, true);
    }
}


// Highlight place on map.
// place == null to just clear the selection
// fromList : user chose place from the left-side index, not the map
function selectOnMap(place, fromList) {
    // console.log("selectOnMap 1");
    window.map.highlightPin(place ? place.pin : null);
    if (place != null) {
        if (place.location.latitude != null && place.location.longitude != null) {
            setCookie("mapCenter", "" + place.location.latitude + "," + place.location.longitude);
        }
        if (fromList) {
            window.map.showPlace(place, proximity(place), true);
        }
    }
    // console.log("selectOnMap 2");
}

var latKm = 0.000089; // Pembs. 
var longKm = 0.000144;

function proximity(place) {
    if (place.zoom && place.zoom > 2 && place.zoom < 20) return place.zoom;
    var min = 1000000;
    window.orderedList.forEach(function (otherPlace) {
        if (otherPlace === place) return false;
        var dlat = (place.location.latitude - otherPlace.location.latitude) / latKm;
        var dlon = (place.location.longitude - otherPlace.location.longitude) / longKm;
        var product = dlat * dlat + dlon * dlon;
        if (product < min) min = product;
    });
    return min < 16 ? 19 : min < 50 ? 17 : 16;
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
            .format(id, place.title.replace("'", "").replace('"', '').replace("&quot;", ""), place.location.latitude, place.location.longitude, "Edit"));
    description = description.replace(/{{/, "<article src='").replace(/}}/, "'/>");
    $("#textbox").html(description);
    $("#textbox").fadeIn("slow");
    $("article").each(function (i) { getBlog($(this).attr("src")); });
}

function getBlog(url) {
    var geturl = url.replace("http://", "https://moylgrove-history.azurewebsites.net/api/fetch?code=" + window.keys.Client_Fetch_FK + "&src=");
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
        url: apiUrl + 'remove?code=' + window.keys.Client_Remove_FK,
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
    delete window.location.queryParameters.place;
    // Retrieve place from server:
    $.get(apiUrl + "place?id=" + id, function (data, status) {
        if (data.length == 0) return;
        // A zone the place is in:
        var zone = data[0].HomeZone;
        if (zone) {
            if (window.zoneSelection.indexOf(zone) < 0) {
                setZoneChoice((includePrevious ? window.zoneSelection + " " : "") + zone);
            }
        }
    });

}

// On user clicks a place
function go(id, fromList) {
    window.map.closePopup();
    $("#message").hide();
    $("#blog").fadeOut();
    var place = window.items[id];
    if (!place) {
        // Not in current index probably because it's outside the currently selected zone.
        retryZone(id, true);
        return;
    }
    if (place.principal) {
        window.map.showPlace(place);
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

function doAddPlace() {
    var loc = window.map.menuBox.getPosition();
    window.map.menuBox.close();
    window.open("editor.htm?cmd=add&lat={0}&long={1}".format(loc.lat, loc.lng), "_blank");
}


function clearMessageOrMapSelection() {
    if ($("#message").is(":visible")) {
        $("#message").fadeOut();
    }
    else { clearMapSelection(); }
}

function clearMapSelection() {
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
        if (newPlace.deleted) {
            delete window.items[newPlace.id];
            var i = window.orderedList.indexOf(oldPlace);
            if (i >= 0) window.orderedList.splice(i, 1);
            var j = window.interesting.indexOf(oldPlace);
            if (j >= 0) window.interesting.splice(j, 1);
            clearMapSelection();
            window.map.closePopup();
            window.map.removePin(oldPlace);
            if (window.queryParameters.place) window.location.assign(".");
        } else {
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
                window.map.setPin(pushpin, newPlace);
                newPlace.pin = pushpin;
                if (newPlace.cf != oldPlace.cf) showPlaceList();
                go(newPlace.id, false);
            } else {
                window.location.assign("./?place=" + newPlace.id);
            }
        }
    }
});

var healthMenuCodes = ["UO", "VOL", "OK", "SI", "V", "?"];
var healthMenuLabels = ["unoccupied", "volunteer", "ok", "self-isolating", "vulnerable", "unknown"];
var healthMenuColors = ["black", "cyan", "lightgreen", "yellow", "orange", "red"];
var healthMenuStack = "<div class='healthMenu'>";
for (var i = 0; i < healthMenuCodes.length; i++) {
    healthMenuStack += "<div class='healthMenuItem' "
        + `style='background-color:${healthMenuColors[i]}' `
        + `title='${healthMenuLabels[i]}'`
        + `onclick='setHealthCode("${healthMenuCodes[i]}");event.stopPropagation()'`
        + "></div>";
}
healthMenuStack += "</div>";

function pinColor2(health) {
    for (var i = 0; i < healthMenuCodes.length; i++) {
        if (health == healthMenuCodes[i]) return healthMenuColors[i];
    }
    return "red";
}

function setHealthCode(code) {
    if (!window.poppedUpPlace) return;
    if (!window.poppedUpPlace.place2) {
        createPlace2(window.poppedUpPlace, code);
    } else {
        window.poppedUpPlace.place2.health = code;
        updatePlace2(window.poppedUpPlace);
    }
}

function createPlace2(place, code) {
    place.place2 = { PartitionKey: "p1", RowKey: place.id, Name: place.title, health: code };
    updatePlace2(place);
}

function updatePlace2(place) {
    if (!place.place2) return;
    let pin = place.pin;
    if (pin) pin.setOptions(window.map.pinOptions(place));
    g("popHealthButton").style.backgroundColor = pinColor2(place.place2.health);
    fetch(apiUrl + "updateplace2?code=" + "tLFYDagKuavQXFaPDrPlhfS9QfgtHaf1RFJk4RWEJ6WeWnTarmbOfA==",
        {
            body: JSON.stringify(place.place2),
            headers: {
                'content-type': 'application/json'
            },
            method: 'PUT',
            credentials: "same-origin"
        });
}

/**
 * Get text from private db.
 * @param {} place 
 */
function popupText2(place) {
    if (!window.places2) return "";
    let p2 = place.place2 || {};
    let bits2 = [];
    if (bits2) { 
        let b2 = [p2.Owner, ((p2.Phone || "") + " " + (p2.email || "")).trim(), p2.Description];
        for (var i in b2) {
            if (b2[i]) bits2.push(b2[i]);
        }
    }
    let text2 = bits2.join("<br/>");
    let buttonColor = pinColor2(p2 && p2.health);
    let ctext2 = `<div class='popup2' onclick='edit2("${place.id}")'><button`
        + " id='popHealthButton' style='background-color:" + buttonColor + "'>" + healthMenuStack + "</button>"
        + text2 + "</div>";
    return ctext2;
}

function popupText(place) {
    window.poppedUpPlace = place;
    if (!place) return "";
    var striptext = place.text.replace(/<[^>]*>/g, " ").trim() || place.subtitle || "";
    var shorttext = popupText2(place) + (striptext.length > 200
        ? striptext.substr(0, 200) + "..."
        : striptext);
    var picUrl = "";
    if (place.pic1 && place.pic1[0] != "!") {
        picUrl = place.pic1;
    } else if (place.pic2) {
        picUrl = place.pic2.split(";")[0];
    }
    if (picUrl) {
        picUrl = picUrl.replace(/^images\//, imgUrl);
        shorttext = "<table width='100%' border='0'><tr valign='top'><td>" +
            "<img src='" + picUrl + "' width=100 align='left' />" +
            "</td><td>" + shorttext + "</td></tr></table>";
    }

    return shorttext;
}

function edit2(id) {
    let p1 = window.items[id];
    let p2 = window.places2[id];
    if (!p2) {
        p2 = {PartitionKey:"p1",
            RowKey:id, 
            Name:p1.title}; 
        p1.place2 = p2;
        window.places2[id] = p2;
    }
    g("edit2uiTitle").innerHTML = p2.Name || "";
    g("edit2uiResident").value = p2.Owner || "";
    g("edit2uiPhone").value = p2.Phone || "";
    g("edit2uiEmail").value = p2.Email || "";
    g("edit2uiC3").value = p2.c3 || "";
    g("edit2uiC4").value = p2.c4 || "";
    g("edit2uiDescription").value = p2.Description || "";
    g("edit2ui").placeId = id;
    $("#edit2ui").show();
}
function closeEdit2() {
    var id = g("edit2ui").placeId;
    var p2 = window.places2[id];
    p2.Owner = g("edit2uiResident").value;
    p2.Phone = g("edit2uiPhone").value;
    p2.Email = g("edit2uiEmail").value;
    p2.c3 = g("edit2uiC3").value;
    p2.c4 = g("edit2uiC4").value;
    p2.Description = g("edit2uiDescription").value;
    updatePlace2(window.items[id]);
}

function strip(s) {
    return;
}

// Title of principal must be ~= name of zone
function zoneFromPrincipal(place) {
    return place.title.toLocaleLowerCase().replace(/ /, "");
}

// From the drop-down menu.
function getChoiceFromUI(selector) {
    var selection = "";
    $(selector).children("input").each(function (i, e) { if (e.checked) selection += " " + e.value; });
    return selection.trim();
}

// Set the drowpdown menu to reflect the current zone selection, obtained from a cookie.
function showChoiceOnUI(selector, zones) {
    if (zones) {
        $(selector).html(zones.replace(/ .*/, "..."));
        $(selector + "Select").children("input").each(function (i, e) {
            e.checked = (zones.indexOf(e.value) >= 0);
        });
    }
    else { $(selector).html("<span style='background-color:red'>Choose...</span>"); }
}

function setZoneCookie(zones) {
    setCookie("zones", zones, 1000);
}

function getZoneChoiceFromCookie() {
    return getCookie("zones");
}

function updateMapStyle () {
    var mapStyleChoice = getChoiceFromUI("#mapStyleSelect").toLowerCase();
    window.map.mapChange(mapStyleChoice);
}


// Zone dropdown: User may have changed the zone selection
function updateZoneChoice() {
    var zoneChoice = getChoiceFromUI("#zoneSelect");
    if (window.zoneSelection == zoneChoice) return;
    // Forget any previous navigation to a specific place:
    delete window.location.queryParameters.place;
    setZoneChoice(zoneChoice);
}

// Move to and display a different zone
function setZoneChoice(zoneChoice) {
    window.zoneSelection = zoneChoice;
    showChoiceOnUI("#zone", zoneChoice);
    setZoneCookie(zoneChoice);
    displayZone(zoneChoice);
}


