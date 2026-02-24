// Code for main page of History Map.

// Reload with https unless testing locally.
if (window.location.protocol == "http:" && window.location.hostname != "localhost") {
    window.location = window.location.href.replace("http:", "https:");
}
var rightClickActions = [{ label: "Add place here", eventHandler: () => { window.map.doAddPlace(); } }];

// Escape a value for safe insertion into an HTML string.
function esc(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


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
     setMapSelectors();
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
            .then(function (response) {
                if (!response.ok) throw new Error(response.status);
                return response.json();
            })
            .then(gotTable) // Async
            .catch(function (err) {
                window.alert("Sorry - problem getting the map data. Please tell alan@pantywylan.org");
            });
        if (window.place2.authCheck()) {
            fetch(fetchApi2)
                .then(response => {
                    if (!response.ok) throw new Error(response.status);
                    return response.json();
                })
                .then(r => window.place2.gotTable(r))
                .catch(err => { console.warn("Failed to load private data:", err); });
        }
    } else {
        appInsights.trackEvent("load", { noHistory: window.noHistory, fetch: "false" }, {});
        placeListsGot = 0;
        $.get(fetchApi, function (data, status) {
            gotTable(data);
        });
    }
    window.loadedTime = new Date().getTime();
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
    window.placeList.show();

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
    var $box = $("#textbox").empty();

    // Title / meta header — use .text() so values are never interpreted as HTML
    $box.append(
        $("<table width='100%'>").append(
            $("<tr>").append(
                $("<td class='texthead'>").text(place.title),
                $("<td align='right'>").text(place.postcode)
            ),
            $("<tr>").append(
                $("<td>").append($("<small>").text(place.subtitle)),
                $("<td align='right'>").append($("<small>").text(place.year))
            )
        )
    );

    // place.text is intentional rich HTML authored in the editor; keep as .html().
    var descHtml = trimQuotes(place.text)
        .replace(/{{/, "<article src='")
        .replace(/}}/, "'/>");
    $box.append($("<span class='description'>").html(descHtml));

    if (window.location.queryParameters.noedit == null) {
        $box.append(
            $("<table width='100%' class='buttons'>").append(
                $("<tr>").append(
                    $("<td>").append(
                        $("<a>").attr("href", "#").text("Edit").on("click", () => editPlace(id, place.title))
                    ),
                    $("<td align='center'>").append(
                        $("<a>").attr("href", "#").text("Share").on("click", () => showLink(id))
                    ),
                    $("<td align='right'>").append(
                        $("<a>").text("Send directions").attr("href",
                            "mailto:?subject=Directions&body=Click this link for directions:%0A https://www.google.co.uk/maps/dir//{0},{1}/@{0},{1},11z "
                            .format(place.location.latitude, place.location.longitude))
                    )
                )
            )
        );
    }

    $box.fadeIn("slow");
    $("article").each(function (i) { getBlog($(this).attr("src")); });
}

function getBlog(url) {
    var geturl = url.replace("http://", "https://moylgrove-history.azurewebsites.net/api/fetch?code=" + window.keys.Client_Fetch_FK + "&src=");
    $("#blog").fadeIn().children("iframe").attr("src", geturl);
}

class PersonSearch {
    searchPerson() {
        var gn = $('#searchName')[0].value.trim();
        var ln = $('#searchLastName')[0].value.trim();
        var syob = $('#searchYob')[0].value.trim();
        if (!gn && !ln && !syob) return;
        $('#searchResult').show(200);
        $("#searchCloseButton").css("background-color", "darkred");
        var $tbody = $("<tbody>");
        var $table = $("<table>").append(
            $("<thead>").append(
                $("<tr>").append(
                    $("<th>").text("source"), $("<th>").text("house"),
                    $("<th>").text("given"), $("<th>").text("surname"),
                    $("<th>").text("b"), $("<th>").text("origin")
                )
            ),
            $tbody
        );
        $('#searchResult').empty().append($table);
        this._fetch("census", gn, ln, syob, "", function (results) {
            if (results.length > 0) {
                for (const t of results) {
                    var origin = t.Origin === "m" ? "Moylg" : (t.Origin || "");
                    var $house = $("<span>").text(t.HouseName || "");
                    if (t.PlaceId) $house.addClass("darklink").on("click", () => go(t.PlaceId, 1));
                    $tbody.append(
                        $("<tr>").append(
                            $("<td>").text((t.PartitionKey || "") + "cs"),
                            $("<td>").append($house),
                            $("<td>").text(t.GivenNames || ""),
                            $("<td>").text(t.Surname || ""),
                            $("<td>").text(t.YoB || ""),
                            $("<td>").text(origin)
                        )
                    );
                }
            }
        });
        this._fetch("graves", gn, ln, syob, "", function (results) {
            if (results.length > 0) {
                for (const t of results) {
                    var $home = $("<span>").text(t.home || "");
                    if (t.assigned) $home.addClass("darklink").on("click", () => go(t.assigned, 1));
                    $tbody.append(
                        $("<tr>").append(
                            $("<td>").text("grave"),
                            $("<td>").append($home),
                            $("<td>").text(t.firstNames || ""),
                            $("<td>").text(t.lastName || ""),
                            $("<td>").text(t.yob || ""),
                            $("<td>").text("- " + (t.yod || ""))
                        )
                    );
                }
            }
        });
    }

    startSearch(firsts, last, yob) {
        appInsights.trackEvent("clickPerson");
        var first = firsts.split(" ")[0];
        $('#searchName')[0].value = first;
        $('#searchLastName')[0].value = last;
        $('#searchYob')[0].value = yob;
        this.searchPerson();
    }

    getPeopleData(id, houseName) {
        if (!id) return;
        var censusYears = {};
        this._fetch("census", "", "", "", id, (result) => {
            if (result.length > 0) {
                var showHouseName = false;
                var cf = comparable(houseName);
                for (const t of result) {
                    if (t.HouseName && comparable(t.HouseName) != cf) { showHouseName = true; }
                    if (!censusYears[t.PartitionKey]) { censusYears[t.PartitionKey] = []; }
                    censusYears[t.PartitionKey].push(t);
                }
                $("#textbox").append(
                    $("<h4>").append(
                        $("<a>").attr("href", "#").text("Census entries")
                            .on("click", function () { $('#census').toggle('slide'); })
                    )
                );
                var $table = $("<table>");
                var householdName = "";
                for (const cy in censusYears) {
                    var yearEntries = censusYears[cy];
                    $table.append($("<tr>").append($("<td>").attr("colspan", 5).append($("<b>").text(cy))));
                    for (const t of yearEntries) {
                        if (showHouseName && t.HouseName != householdName) {
                            householdName = t.HouseName;
                            $table.append($("<tr>").append($("<td>").attr("colspan", 5).append($("<i>").text(householdName))));
                        }
                        const yob = (t.YoB || "").substr(0, 4);
                        var $name = $("<span class='link'>")
                            .text((t.GivenNames || "") + " " + (t.Surname || ""))
                            .on("click", () => startSearch(t.GivenNames, t.Surname, yob));
                        $table.append(
                            $("<tr>").append(
                                $("<td>").append($name),
                                $("<td>").text(yob),
                                $("<td>").text(t.Age || ""),
                                $("<td>").text(this._decode({ h: "head", sole: "head", w: "wife", s: "son", d: "dgtr", b: "bro" }, t.Relationship || "")),
                                $("<td>").text(this._decode({ s: "sgl", m: "mrd", u: "unm", w: "wdw", d: "div" }, t.Condition || "")),
                                $("<td>").text(t.Occupation || "")
                            )
                        );
                    }
                }
                $("#textbox").append($table);
            }
        });
    }

    getGraves(id) {
        if (!id) return;
        this._fetch("graves", "", "", "", id, function (result) {
            if (result.length > 0) {
                result.sort(function (a, b) { return a.yod - b.yod; });
                var $table = $("<table>");
                for (const t of result) {
                    var $first = $("<span class='link'>").text(t.firstNames || "")
                        .on("click", () => startSearch(t.firstNames, t.lastName, t.yob));
                    var $last = $("<span class='link'>").text(t.lastName || "")
                        .on("click", () => startSearch(t.firstNames, t.lastName, t.yob));
                    $table.append(
                        $("<tr>").append(
                            $("<td>").text(t.yob || ""),
                            $("<td>").text("-" + (t.yod || "")),
                            $("<td>").append($first),
                            $("<td>").append($last),
                            $("<td>").text(t.age || ""),
                            $("<td>").text(t.home || ""),
                            $("<td>").text(t.graveId || "")
                        )
                    );
                }
                $("#textbox").append(
                    $("<h4>").append(
                        $("<a>").text("Gravestones")
                            .attr("href", "https://drive.google.com/file/d/1LjXR1C27fwazM0Ovib4oKRdfxY47TAcc/view")
                            .attr("target", "graves")
                    ),
                    $table
                );
            }
        });
    }

    _fetch(table, first, last, year, place, cb) {
        if (typeof fetch !== 'undefined') {
            fetch(apiUrl + "{0}?first={1}&last={2}&year={3}&place={4}"
                .format(table, first || "", last || "", year || "", place || ""))
                .then(function (response) {
                    if (!response.ok) throw new Error(response.status);
                    return response.json();
                })
                .then(function (results) { cb(results); });
        }
        else {
            $.get(apiUrl + "{0}?first={1}&last={2}&year={3}&place={4}"
                .format(table, first || "", last || "", year || "", place || ""),
                function (data, status) {
                    cb(data);
                });
        }
        appInsights.trackEvent("search");
    }

    _decode(m, code) {
        var d = m[code];
        return d ? d : code;
    }
}

window.personSearch = new PersonSearch();
function searchPerson()                 { window.personSearch.searchPerson(); }
function startSearch(firsts, last, yob) { window.personSearch.startSearch(firsts, last, yob); }

class AudioPlayer {
    constructor() {
        this._load();
    }

    _load() {
        $.get("https://moylgrovehistory.blob.core.windows.net/audiovis?restype=container&comp=list", function (data, status) {
            var nameElements = data.getElementsByTagName("Name");
            window.avlist = $.makeArray(nameElements).map(function (x) { return x.textContent.replace(".mp3", ""); });
        });
    }

    play(id) {
        if (!id) return;
        $("#audiodiv").hide();
        if (window.avlist && window.avlist.includes(id)) {
            $("#audiodiv").html("<audio controls><source src='{0}{1}.mp3' type='audio/mpeg'></source></audio><br/>Commentary &copy; Sally James".format(avUrl, id));
            $("#audiodiv").show();
        }
    }
}

window.audioPlayer = new AudioPlayer();

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
    window.placeList.select(id, fromList);
    selectOnMap(place, fromList);
    if (!window.noHistory) {
        showMainText(id, place);
        showStreetView(place.pic1);
        showSlides(place.pic2);
        window.personSearch.getPeopleData(id, place.title);
        window.personSearch.getGraves(id);
        window.audioPlayer.play(id);
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
    window.placeList.select(null, false);
    if (window.fader != null) { clearInterval(fader); window.fader = null; }
    if (window.menuBox != null) { window.menuBox.setOptions({ visible: false }); }
}

window.addEventListener("beforeunload", function (e) {
    // Clear only the key used for communicating with the editor window.
    if (localStorage) localStorage.removeItem("place");
});

// Called when the edit window has updated a place.
// It puts the item in local store as well as sending to server.
window.addEventListener("storage", function (event) {
    if (event.key == "place") {
        var newPlace;
        try {
            newPlace = makePlace(JSON.parse(event.newValue));
        } catch (e) {
            console.warn("Failed to parse place from storage:", e);
            return;
        }
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
                if (newPlace.cf != oldPlace.cf) window.placeList.show();
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

class Place2Manager {
    constructor() {
        this._menuHtml = this._buildMenuHtml();
    }

    _buildMenuHtml() {
        var html = "<div class='healthMenu'>";
        for (var i = 0; i < healthMenuCodes.length; i++) {
            html += "<div class='healthMenuItem' "
                + `style='background-color:${healthMenuColors[i]}' `
                + `title='${healthMenuLabels[i]}'`
                + `onclick='setHealthCode("${healthMenuCodes[i]}");event.stopPropagation()'`
                + "></div>";
        }
        html += "</div>";
        return html;
    }

    pinColor(health) {
        for (var i = 0; i < healthMenuCodes.length; i++) {
            if (health == healthMenuCodes[i]) return healthMenuColors[i];
        }
        return "red";
    }

    authCheck() {
        if (location.host == "localhost") return true;
        if (getCookie("privatedb")) return true;
        return false;
    }

    gotTable(results) {
        if (!results) return;
        window.places2 = {};
        for (var i = 0, t; t = results[i]; i++) {
            window.places2[t.RowKey] = t;
        }
        mergeTables();
    }

    setHealthCode(code) {
        if (!window.poppedUpPlace) return;
        if (!window.poppedUpPlace.place2) {
            this._create(window.poppedUpPlace, code);
        } else {
            window.poppedUpPlace.place2.health = code;
            this._update(window.poppedUpPlace);
        }
    }

    /**
     * Get text from private db.
     */
    popupText(place) {
        if (!window.places2) return "";
        let p2 = place.place2 || {};
        let bits2 = [];
        let b2 = [p2.Owner, ((p2.Phone || "") + " " + (p2.email || "")).trim(), p2.Description];
        for (var i in b2) {
            if (b2[i]) bits2.push(esc(b2[i]));
        }
        let text2 = bits2.join("<br/>");
        let buttonColor = this.pinColor(p2 && p2.health);
        let ctext2 = `<div class='popup2' onclick='edit2("${esc(place.id)}")'><button`
            + " id='popHealthButton' style='background-color:" + buttonColor + "'>" + this._menuHtml + "</button>"
            + text2 + "</div>";
        return ctext2;
    }

    edit(id) {
        let p1 = window.items[id];
        let p2 = window.places2[id];
        if (!p2) {
            p2 = { PartitionKey: "p1", RowKey: id, Name: p1.title };
            p1.place2 = p2;
            window.places2[id] = p2;
        }
        g("edit2uiTitle").textContent = p2.Name || "";
        g("edit2uiResident").value = p2.Owner || "";
        g("edit2uiPhone").value = p2.Phone || "";
        g("edit2uiEmail").value = p2.Email || "";
        g("edit2uiC3").value = p2.c3 || "";
        g("edit2uiC4").value = p2.c4 || "";
        g("edit2uiDescription").value = p2.Description || "";
        g("edit2ui").placeId = id;
        $("#edit2ui").show();
    }

    closeEdit() {
        var id = g("edit2ui").placeId;
        var p2 = window.places2[id];
        p2.Owner = g("edit2uiResident").value;
        p2.Phone = g("edit2uiPhone").value;
        p2.Email = g("edit2uiEmail").value;
        p2.c3 = g("edit2uiC3").value;
        p2.c4 = g("edit2uiC4").value;
        p2.Description = g("edit2uiDescription").value;
        this._update(window.items[id]);
    }

    _create(place, code) {
        place.place2 = { PartitionKey: "p1", RowKey: place.id, Name: place.title, health: code };
        this._update(place);
    }

    _update(place) {
        if (!place.place2) return;
        let pin = place.pin;
        if (pin) pin.setOptions(window.map.pinOptions(place));
        g("popHealthButton").style.backgroundColor = this.pinColor(place.place2.health);
        fetch(apiUrl + "updateplace2?code=" + window.keys.Client_UpdatePlace2_FK,
            {
                body: JSON.stringify(place.place2),
                headers: {
                    'content-type': 'application/json'
                },
                method: 'PUT',
                credentials: "same-origin"
            });
    }
}

window.place2 = new Place2Manager();
function pinColor2(health)   { return window.place2.pinColor(health); }   // called from map.js
function setHealthCode(code) { window.place2.setHealthCode(code); }        // health button onclick
function edit2(id)           { window.place2.edit(id); }                   // popup onclick
function closeEdit2()        { window.place2.closeEdit(); }                // index.htm line 166

function popupText(place) {
    window.poppedUpPlace = place;
    if (!place) return "";
    var striptext = place.text.replace(/<[^>]*>/g, " ").trim() || place.subtitle || "";
    var shorttext = window.place2.popupText(place) + (striptext.length > 200
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


