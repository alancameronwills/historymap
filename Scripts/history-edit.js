// Code for editor page of History Map.

var azureWS = "https://moylgrove-history.azurewebsites.net/";
var picUrlPrefix = azureWS + "images/";
var codePrefix = azureWS + "api/";
var sourcePrefix = azureWS + "h/";

window.blobService = AzureStorage.createBlobService('moylgrovehistory',
    'FYrLaOQASw3oLaEscmMUWtV70VbcTFGZXxwp0GuaTvJZKguM/C9AiI1nAKp6uw7AP4+k1gXwXTKNw9pcLDiFYA==');

window.addEventListener("beforeunload", function (e) {
    var confirmationMessage = "Close the window and lose edits?";
    if (!window.dirty && hash() == window.oldHash) return "";
    e.returnValue = confirmationMessage;     // Gecko, Trident, Chrome 34+
    return confirmationMessage;              // Gecko, WebKit, Chrome <34
});


function DeletePhoto1() {
    $("#photo1img").hide()[0].src = "";
    $("#photo1google").hide().html("");
    $("#photo1prompt").show();
    $("#photo1url")[0].value = "";
    window.place.Pic1 = "";
    window.dirty = true;
}

function ShowPhoto1(x) {
    SetPhoto1($("#photo1url")[0].value);
}

function SetPhoto1(url) {
    if (!url) return;
    var category = "";
    if (url.match(/.*(jpg|jpeg|png|gif)$/i)) {
        $("#photo1prompt").hide();
        $("#photo1google").html("").hide();
        var picBlob = url.replace(/^images\//, picUrlPrefix);
        $("#photo1img").show()[0].src = picBlob;
        window.place.Pic1 = url;
        category = "pic";
    }
    if (url.match(/^<iframe.*<\/iframe>$/)) {
        var urlx = url.replace(/width=".*?"/, "width='300'").replace(/height=".*?"/, "height='225'");
        $("#photo1prompt").hide();
        $("#photo1img").hide()[0].src = "";
        $("#photo1google").html(urlx).show();
        window.place.Pic1 = url.match(/![^"]*/)[0];
        category = "google";
    }
    if (url.match(/^!/)) {
        var ww = 300;
        var hh = 225;
        content = "<iframe src='https://www.google.com/maps/embed?pb={0}' id='streetview' width='{1}px' height='{2}px' frameborder='0' style='border:0' allowfullscreen></iframe>".format(url, ww, hh);

        $("#photo1prompt").hide();
        $("#photo1img").hide()[0].src = "";
        $("#photo1google").html(content).show();
        window.place.Pic1 = url;
        category = "google";
    }
    window.dirty = true;
}


function SetSlides(slideUrls) {
    for (var i = 0; i < slideUrls.length; i++) {
        var url = slideUrls[i];
        AddPhoto2(url, i == 0);
    }
}

var slideCount = 0;
function AddPhoto2(url, ui) {
    if (!url || !(url.match(/\.(jpg|jpeg|png|gif)$/i))) { return; }
    var picBlob = url.replace(/^images\//, picUrlPrefix);
    $("#photo2Gallery").append("<img id='slide{1}' src='{0}' title='Click to show at left' onclick='ShowPhoto2({1})' style='max-width:100px;max-height:100px;display:inline;'/> "
        .format(picBlob, ++slideCount));
    var gallery = $("#photo2Gallery")[0];
    gallery.lastElementChild.url = url;
    gallery.scrollTop = gallery.scrollHeight;
    if (ui) {
        $("#photo2url")[0].value = "";
        ShowPhoto2(slideCount);
    }
    window.dirty = true;
}

function ShowPhoto2(id) {
    var url = $("#slide" + id)[0].src;
    var picBlob = url.replace(/^images\//, picUrlPrefix);
    $("#photo2img").show()[0].src = picBlob;
    $("#photo2prompt").hide();
    $("#photo2")[0].currentId = id;
}

function DeletePhoto2() {
    var id = $("#photo2")[0].currentId;
    var next = null;
    if (id) {
        $("#photo2")[0].currentId = "";
        var toRemove = $("#slide" + id);
        next = toRemove.next();
        if (next[0] == null) {
            next = toRemove.prev();
        }
        toRemove.remove();
        var gallery = $("#photo2Gallery")[0];
        if (next[0]) {
            $("#photo2")[0].currentId = next[0].id.substr(5);
            $("#photo2img").show()[0].src = next[0].src;
        }
        else {
            $("#photo2prompt").show();
            $("#photo2img").hide()[0].src = "";
        }
    }
    window.dirty = true;
}

function saveSelection() {
    if (window.getSelection) {
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            return sel.getRangeAt(0);
        }
    } else if (document.selection && document.selection.createRange) {
        return document.selection.createRange();
    }
    return null;
}

function restoreSelection(range) {
    if (range) {
        if (window.getSelection) {
            sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (document.selection && range.select) {
            range.select();
        }
    }
}

function nodeIsInLink(n) {
    if (!n) return null;
    if (n.nodeName == "A") return n;
    return nodeIsInLink(n.parentNode);
}

function placeFromTitle(title) {
    var cf = comparable(title);
    return window.places[cf];
}



function createLink() {
    var selection = window.getSelection();
    var inLink = nodeIsInLink(selection.anchorNode);
    if (!isInNode(selection.anchorNode, "text") || selection.isCollapsed && !inLink) {
        window.alert("To create a link to another web page, first select a phrase in the text.");
        return;
    }

    if (inLink) {
        // Expand the selection to the whole link:
        window.getSelection().removeAllRanges();
        var range = document.createRange();
        range.selectNode(inLink);
        window.getSelection().addRange(range);
        $("#linkRef").value = inLink.href;
    } else {
        var phrase = window.getSelection().toString();
        var place = placeFromTitle(phrase);
        if (place) {
            $("#linkRef")[0].value = "./?place=" + place;
        }
    }

    $("#linkRemoveOption")[0].style.display = (inLink ? "block" : "none");
    var jLinkDialog = $("#linkDialog");
    jLinkDialog[0].savedSelection = saveSelection();
    jLinkDialog.show();

    // Select te dialog text:
    $("#linkRef").select();
}
function CompleteCreateLink() {
    var jLinkDialog = $("#linkDialog");
    jLinkDialog.hide();
    restoreSelection(jLinkDialog[0].savedSelection);
    var href = $("#linkRef")[0].value;
    var selection = window.getSelection();
    if (href.length > 5 && !selection.isCollapsed && isInNode(selection.anchorNode, "text")) {
        document.execCommand("CreateLink", false, href);
        $("#text a").attr("target", "_blank");
        $("#text a").each(function (i, e) { e.title = e.href; });
        $("#linkRef")[0].value = "";
        window.dirty = true;
    }
}
function CompleteRemoveLink() {
    var jLinkDialog = $("#linkDialog");
    jLinkDialog.hide();
    restoreSelection(jLinkDialog[0].savedSelection);
    if (isInNode(window.getSelection().anchorNode, "text")) {
        document.execCommand("Unlink");
    }
}


function showDeleteDialog(action, thingToDelete) {
    var dialog = $("#deleteDialog");
    $("#thingToDelete").text(thingToDelete);
    dialog[0].action = action;
    dialog.show();
}

function formatDoc(sCmd, sValue, ui) {
    var x = document.getSelection().focusNode.parentElement;
    if (sCmd == "InsertText" || isInNode(x, "text")) {
        document.execCommand(sCmd, ui, sValue);
    }
    x.focus();
}

// On map system load
function loadMap() {
    $(document).ready(function () {
        window.dirty = false;
        window.maplocation = new Microsoft.Maps.Location(52.068287, -4.747708);
        var place = window.place = {};
        window.map = new Microsoft.Maps.Map(document.getElementById('theMap'),
            {
                mapTypeId: Microsoft.Maps.MapTypeId.aerial,
                center: window.maplocation,
                zoom: 19,
                showLocateMeButton: false,
                showMapTypeSelector: false
            });
        window.pushpin = new Microsoft.Maps.Pushpin(
            window.maplocation,
            { title: "new place", color: "#A00000", text: "+" }
        );
        window.map.entities.push(pushpin);
        setUpMapMenu();
        setUpMapClick();

        if (location.queryParameters.id) {
            window.place = { RowKey: -1, UpdateTrail: "" };
            fetch("{0}/place?id={1}".format(codePrefix, location.queryParameters.id))
                .then(function (response) { return response.json(); })
                .then(function (tt) {
                    var t = tt[0];
                    window.place = t;

                    $("#title")[0].value = trimQuotes(t.Title).replace(/&#39;/, "'").replace(/&quot;/, "\"");
                    $("#subtitle")[0].value = t.Subtitle;
                    $("#year")[0].value = t.Year;
                    $("#postcode")[0].value = t.Postcode.substr(-2, 2);
                    $("#zoom")[0].checked = t.Zoom == "1";
                    $("#text").html(trimQuotes(t.Text));
                    setMapLocation((t.Latitude && t.Longitude ? new Microsoft.Maps.Location(t.Latitude, t.Longitude) : null), true);
                    updatePlaceName();
                    SetPhoto1(t.Pic1);
                    SetSlides(t.Pic2 ? t.Pic2.split(";") : []);
                })
                .catch(function (err) {
                    window.alert("Sorry - problem getting the map data. Please tell alan@pantywylan.org");
                });
        }
        else {
            var lat = location.queryParameters.lat;
            var long = location.queryParameters.long;
            BeginGetNewPlaceId({ longitude: long, latitude: lat });
            $("#text").html("");
            if (zoomed(lat, long)) $("#zoom")[0].checked = true;
            setMapLocation((lat && long ? new Microsoft.Maps.Location(lat, long) : null), true);
        }
        window.oldHash = hash();
    })
};

function hash() {
    var s = gatherToSave();
    var long = s.Title + s.Subtitle + s.Year + s.Postcode + s.Zoom + s.Text + s.Longitude + s.Latitude + s.Pic1 + s.Pic2;
    return hashCode(long);
}

var fixLinks = new RegExp(sourcePrefix, "g");
/// Get bits of data from form, prep to saving.
function gatherToSave() {
    var s = {};
    s.PartitionKey = "p1"; // TODO Make dependent on region.
    s.RowKey = "" + window.place.RowKey; // ensure string
    s.Title = $("#title")[0].value.trim().replace(/'/, "&#39;").replace(/"/, "&quot;");
    s.Subtitle = $("#subtitle")[0].value.trim();
    s.Year = $("#year")[0].value.trim();
    var pcEnd = $("#postcode")[0].value.trim();
    s.Postcode = (pcEnd ? "SA43 3" + pcEnd : ""); // TODO generalize for other places
    s.Zoom = ($("#zoom")[0].checked ? "1" : "0");
    s.Text = $("#text").html().replace(fixLinks, "./"); // Tends to get full URL.
    s.Longitude = window.maplocation.longitude.toFixed(6);
    s.Latitude = window.maplocation.latitude.toFixed(6);
    s.Pic1 = window.place.Pic1 || ""; // ensure not undefined

    s.Pic2 = "";
    $("#photo2Gallery img").each(function (ix, img) {
        s.Pic2 += (ix > 0 ? ';' : '') + img.url.replace(picUrlPrefix, "images/");
    });

    // User and date
    s.Updated = new Date().toISOString();
    s.User = window.userName;
    if (window.place.User && s.User != window.place.User) {
        // UpdateTrail shows last edit by a previous editor. Empty until edited by more than one person.
        s.UpdateTrail = window.place.User + "," + window.place.Updated + ";" + window.place.UpdateTrail;
    }
    else s.UpdateTrail = window.place.UpdateTrail;
    // OK to delete if this is completely new:
    if (!location.queryParameters.id) { s.DeleteOK = true; }
    return s;
}

function SavePlace() {
    if (!window.userName) {
        window.alert("You need to sign in before you can save your edits.");
        signin();
        return;
    }
    var s = gatherToSave();
    if (!s.Title) {
        window.alert("Can't save yet: Enter a title in the pink box.");
        return;
    }
    appInsights.trackEvent("save", { title: s.Title, user: window.userName }, {});
    var jsn = JSON.stringify(s);

    fetch(codePrefix + "updateplace?code=sKLci6i34PkB9LlwMjgj3ukP7cj5yfTKpQcH0Mv7eQkgOrXi7/tB4w==",
        {
            body: jsn,
            headers: {
                'content-type': 'application/json'
            },
            method: 'PUT',
            credentials: "same-origin"
        })
        .then(function (r) {
            if (r && r.ok) {
                $("#savedDialog").show();
                window.dirty = false;
                window.oldHash = hash();
                // Pass the updates to the main window:
                localStorage["place"] = jsn;

                window.close();
                /*
                // If this is a new place: redisplay with assigned ID in URL:
                if (!location.queryParameters.id) {
                    window.open(location.origin + location.pathname + "?id=" + s.RowKey, "_self");
                }
                */
            }
            else { throw ("" + r.status + " " + r.statusText); }
        })
        .catch(function (error) {
            if (error.match(/401/)) {
                if (window.confirm("You need to sign in before you can save your edits. Click OK to sign in.")) {
                    signin();
                }
            }
            else window.alert("Failed to save. Try again later, and/or complain to Alan. \n" + error);
        })
        ;
}


function updatePlaceName() {
    var title = $("#title")[0].value.trim();
    window.pushpin.setOptions({ title: title });
    window.dirty = true;
    if (!title) {
        window.alert("Needs a title");
    } else {
        var otherKey = placeFromTitle(title);
        if (otherKey && window.place.RowKey && otherKey != window.place.RowKey) {
            window.alert("This place name is the same as one that's already on the map. Please edit the existing place, "
                + "rather than creating a new one.\nI'll now open a new window where you can do that (or you can decide to come back to this window).");
            window.open("./editor.htm?id=" + otherKey);
            window.dirty = false;
            window.oldHash = hash();
            window.alert("This window shows the new place you created. If you used the other window to edit the existing place instead, you can close this without Saving.");
        }
    }
}

function CentreMapOnPlace() {
    window.map.setView({ center: window.maplocation });
}

function setMapLocation(loc, moveMap) {
    if (!loc) loc = new Microsoft.Maps.Location(52.068287, -4.747708);
    window.maplocation = loc;
    var lat = loc.latitude.toFixed(6);
    var long = loc.longitude.toFixed(6);
    $("#latlong").text("{0}, {1}".format(lat, long));
    $("#googleLink")[0].href = "https://www.google.co.uk/maps/@{0},{1},400m/data=!3m1!1e3".format(lat, long);
    window.pushpin.setLocation(loc);
    if (moveMap) {
        window.map.setView({ center: loc });
    }
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
                    label: "Move place to here  .",
                    eventHandler: function () {
                        var loc = window.menuBox.getLocation();
                        window.menuBox.setOptions({ visible: false });
                        setMapLocation(loc, false);
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
        if (window.menuBox != null) { window.menuBox.setOptions({ visible: false }); }
    });
}

function mapChange(v) {
    if (v == "os") {
        if (window.map.getZoom() > 17) {
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

function BeginGetNewPlaceId(location) {
    window.place = { RowKey: hashLocation(location), UpdateTrail: "" };
    /*
    window.place = { id: -1 };
    fetch(codePrefix + "index")
        .then(function (r) {r.text();})
        .then(function (r){
            window.place.id = r;
        });
    */
}

// Create a unique id for a pin by interleaving digits of the lat & long.
// The idea of doing it from the lat & long is that when searched in the table,
// pins that are near to each other on the ground will be near in the table.
// So a rough "find all the nearby pins" is just a matter of truncating the id as a search term.
function hashLocation(location) {
    var x = (parseFloat(location.longitude) + 300).toFixed(6);
    var y = (parseFloat(location.latitude) + 200).toFixed(6);
    var key = "";
    for (var i = 0; i < x.length; i++) {
        if (x.charAt(i) != ".") {
            key += x.charAt(i) + y.charAt(i);
        }
    }

    return key + TwoRandomDigits();
}

function TwoRandomDigits() {
    return ("" + Date.now()).substr(-2, 2);
}


function UploadFile2(ff) {
    var count = ff.length;
    $("#photo2prompt").text("Uploading " + count + "...").show();
    $("#photo2img").hide();
    var fn = window.place.RowKey + "-" + (new Date()).getTime().toString().substr(2, 10);
    $.each(ff, function (i, file) {
        var suffix = file.name.replace(/^.*\./, ".").toLowerCase();
        var fileName = fn + "-" + i + suffix;
        window.blobService.createBlockBlobFromBrowserFile('history-img',
            fileName, file, null,
            function (error, result, response) {
                if (!error) {
                    if (--count <= 0) {
                        $("#photo2prompt").text("Done.");
                    }
                    else {
                        $("#photo2prompt").text("Uploading " + count + "...")
                    }
                    AddPhoto2("images/" + fileName, count <= 0);
                }
                else {
                    $("#photo2prompt").text("Failed.");
                }
            });

    });
}

function UploadFile(f) {
    $("#photo1prompt").text("Uploading...").show();
    $("#photo1img").hide();
    $("#photo1google").hide();
    var suffix = f.name.replace(/^.*\./, ".").toLowerCase();
    var fileName = window.place.RowKey + "-" + (new Date()).getTime().toString() + suffix;
    window.blobService.createBlockBlobFromBrowserFile('history-img', fileName, f, null,
        function (error, result, response) {
            if (!error) {
                $("#photo1prompt").text("Done.");
                SetPhoto1("images/" + fileName);
            }
            else {
                $("#photo1prompt").text("Failed.");
            }
        });
}

function getAllPlaces() {
    window.places = {};
    var fetchApi = codePrefix + "places?fields=RowKey,Title";
    $.get(fetchApi, function (results, status) {
        $.each(results, function (i, v) {
            if (v && v.Title) {
                var tcf = comparable(v.Title);
                if (tcf) {
                    window.places[tcf] = v.RowKey;
                }
            }
        })
    });
}

// Sign-in dialog. Separate window, but Chrome disallows nearly all communication.
var sub = null;
var timer = null;
function signin() {
    sub = window.open('sign-in.htm' + window.location.search, '', "width=400,height=500,left=200,top=100,toolbar=0,status=0");
    timer = setInterval(checkChild, 1000);
}
function checkChild() {
    if (!sub || sub.closed) {
        clearInterval(timer);
        window.signinDone();
    }
}
window.signinDone = function () {
    checkSignin();
}

function checkSignin() {
    $.ajax({
        url: codePrefix + "test", xhrFields: { withCredentials: true }, complete: function (data, status) {
            var headers = data && data.responseJSON ? data.responseJSON.headers : {};
            var n = headers["x-ms-client-principal-name"] || null;
            setUserName(n);
            setCookie("username", name, 1000);
            var idp = headers["x-ms-client-principal-idp"] || "";
            if (idp) {
                setCookie("useridp", idp, 1000);
            }
        }
    });

    /*
                $.ajax({url:codePrefix + "test", xhrFields:{withCredentials:true}}, function (data, status) {
                        var n = data && data.headers ? data.headers["x-ms-client-principal-name"] : null;
                        setUserName(n);
                        setCookie("username", name, 1000);
                        var idp = data && data.headers ? data.headers["x-ms-client-principal-idp"] : "";
                        if (idp) {
                            setCookie("useridp", idp, 1000);
                        }
                }); 
     */
    /*
    fetch(codePrefix + "test", { credentials: "same-origin" })
        .then(function (r){r.json();})
        .then(function(r){
            var name = r && r.headers ? r.headers["x-ms-client-principal-name"] : "";
            setUserName(name, false);
            setCookie("username", name, 1000);
            var idp = r && r.headers ? r.headers["x-ms-client-principal-idp"] : "";
            if (idp) {
                setCookie("useridp", idp, 1000);
            }
        });  */
}

function setUserName(name, fromCookie) {
    window.userName = name;
    if (name) {
        $("#username").text(name);
        $("#username").append("<input type='button' class='deleteButton' onclick='signOut()' value='X' "
            + "title='Remove this username so that you can sign in with a different account.' />&nbsp;&nbsp;&nbsp;");
        window.isSignedIn = true;
        appInsights.setAuthenticatedUserContext(name);
    }
    else {
        window.isSignedIn = false;
        $("#username").html("<input type='button' onclick='signin()' value='Sign in'/>&nbsp;&nbsp;&nbsp;");
    }
}

function signOut() {
    setCookie("username", "", -1);
    setCookie("useridp", "", -1);
    setUserName("", true);
    appInsights.trackEvent("sign out");
}

function getUserName() {
    var name = getCookie("username");
    setUserName(name, true);
    if (!name) { $("#signinDialog").show(); }
}

// initialization
$(document).ready(function () {
    getAllPlaces();
    getUserName();
    if (!isAdvancedBrowser) {
        $("body").html("<div style='position:fixed;top:100px;font-size:large;font-weight:bold;margin:10px;'>Sorry - This form doesn't work on your browser. Please complain to Alan.</div>");
        appInsights.trackEvent("old browser");
    }
});
