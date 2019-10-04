// Code for editor page of History Map 

var rightClickAction = ["Move place to here", "window.map.moveSinglePin()"];

function onKeysArrived() {
    window.blobService = AzureStorage.createBlobService('moylgrovehistory',
        window.keys.Client_BlobService_K);
}
//
// Initialize map and location
//


function initMapCentre() {
    var lat = location.queryParameters.lat;
    var long = location.queryParameters.long;

    return lat && long ? "" + lat + "," + long : getCookie("mapCenter") || "52.068287,-4.747708";
}

// On map load
function onMapLoaded() {
        window.place = {
            RowKey: -1, UpdateTrail: "", dirty: false,
        };
        // Hash is used for a quick check if anything's changed:
        window.oldHash = 0;
        window.dirty = false;

        // Make an index of places in this zone to assist with 
        // creating links to other places.
        getAllPlaces();

        // Was a place specified to edit?
        if (location.queryParameters.id) { // location here is current URL
            window.place = { RowKey: -1, UpdateTrail: "" };
            // REST get details of place to edit:
            fetch("{0}/place?id={1}".format(apiUrl, location.queryParameters.id))
                .then(function (response) { return response.json(); }) // Decode string to object
                .then(function (tt) {
                    var t = tt[0];
                    window.place = makePlace(t);
                    var title = trimQuotes(t.Title).replace(/&#39;/, "'").replace(/&quot;/, "\"");
                    createSinglePin(window.place);
                    $("#title")[0].value = title;
                    $("#subtitle")[0].value = t.Subtitle;
                    $("#year")[0].value = t.Year;
                    $("#postcode")[0].value = t.Postcode;
                    $("#tags")[0].value = t.Tags || "";
                    $("#zoom")[0].checked = t.Zoom == "1";
                    $("#text").html(trimQuotes(t.Text));
                    ShowPhoto1(t.Pic1);
                    SetSlides(t.Pic2 ? t.Pic2.split(";") : []);
                    window.oldHash = hash();
                })
                .catch(function (err) {
                    window.alert("Sorry - problem getting the map data. Please tell alan@pantywylan.org\n" + err);
                });
        }
        else {
            // No existing place: create a new one with the given location
            var lat = location.queryParameters.lat;
            var long = location.queryParameters.long;
            // Create id for new place. 
            window.place = { RowKey: hashLocation({ longitude: long, latitude: lat }), UpdateTrail: "" };
            createSinglePin(window.place);
            $("#text").html("");
            if (zoomed(lat, long)) $("#zoom")[0].checked = true;
            window.oldHash = hash();
        }
};

// Make a map with a single pushpin
function createSinglePin(place) {
    // Attach the pin to the map:
    window.map.singlePin = window.map.makePin(place);
    window.map.showPlace(place);


    /*
    // Functions for changing the pin:
    window.map.setTitle = function (title) { this.singlePushpin.setOptions({ title: title }); }
    window.map.movePinTo = function (loc, moveMap) {
        this.singlePushpin.setLocation(loc);
        if (moveMap) {
            this.setView({ center: loc });
        }
    }
    
    // Pan map to show pin at centre
    map.recenter = function () {
        this.setView({center: this.singlePushpin.getLocation()});
    }
    map.getPinCenter = function () {
        return this.singlePushpin.getLocation();
    }
    */
}

function moveSinglePin() {
    singlePlace.location = window.map.menuBox.getPosition();
    singlePin.setPlace(singlePlace);
}



// User clicked to put the map back on the place (maybe after panning it around and losing the place)
function onCentreMapOnPlace() {
    window.map.recenter();
}

// Set the various places in the UI the lat & long appear. Return the Location.
function setPinLocation(lat, long) {
    var latString = (lat || 52.068287).toFixed(6);
    var longString = (long || -4.747708).toFixed(6);
    $("#latlong").text("{0}, {1}".format(latString, longString));
    $("#googleLink")[0].href = "https://www.google.co.uk/maps/@{0},{1},400m/data=!3m1!1e3".format(latString, longString);
    return window.map.mapCoords(latString + "," + longString);
}


// Called when map type selector changes (aerial photo | OS map).
function onMapTypeSelect(v) {
    if (v == "os") {
        if (window.map.getZoom() > 17) {
            // Zoom out to where real OS map is available
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


// User has changed the title.
function onUpdatePlaceName() {
    var title = $("#title")[0].value.trim();
    window.dirty = true;
    window.map.setTitle(title);
    if (!title) {
        window.alert("Needs a title");
    } else {
        // Check if there's another place with the same name:
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

// Used for a quick check whether anything on the form has changed
function hash() {
    var s = gatherToSave();
    var long = s.Title + s.Subtitle + s.Year + s.Postcode + s.Zoom + s.Text + s.Longitude + s.Latitude + s.Pic1 + s.Pic2 + s.Tags;
    return hashCode(long);
}

window.addEventListener("beforeunload", function (e) {
    var confirmationMessage = "Close the window and lose edits?";
    if (!window.dirty && hash() == window.oldHash) return "";
    e.returnValue = confirmationMessage;     // Gecko, Trident, Chrome 34+
    return confirmationMessage;              // Gecko, WebKit, Chrome <34
});


//
// Photo1 - the photo that appears under the text
//

// Called on paste of link into upload, or click link button
function onLinkPhoto1() {
    ShowPhoto1($("#photo1url")[0].value);
    window.dirty = true;
}

// Display photo1, which may be a Google streetview
// url = link to our uploaded blob | link to external pic | google iframe embed | abbreviated google iframe embed
function ShowPhoto1(url) {
    if (!url) return;
    var category = "";
    // Link to locally stored blob or external pic
    if (url.match(/.*(jpg|jpeg|png|gif)$/i)) {
        $("#photo1prompt").hide();
        $("#photo1google").html("").hide();
        var picBlob = url.replace(/^images\//, imgUrl);
        $("#photo1img").show()[0].src = picBlob;
        window.place.Pic1 = url;
        category = "pic";
    }
    // Google iframe embed, freshly pasted by user from Google page
    if (url.match(/^<iframe.*<\/iframe>$/)) {
        var urlx = url.replace(/width=".*?"/, "width='300'").replace(/height=".*?"/, "height='225'");
        $("#photo1prompt").hide();
        $("#photo1img").hide()[0].src = "";
        $("#photo1google").html(urlx).show();
        window.place.Pic1 = url.match(/![^"]*/)[0];
        category = "google";
    }
    // Google iframe embed, abbreviated when previously stored by us
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
}

// Called on click Delete button
function onDeletePhoto1() {
    $("#photo1img").hide()[0].src = "";
    $("#photo1google").hide().html("");
    $("#photo1prompt").show();
    $("#photo1url")[0].value = "";
    window.place.Pic1 = "";
    window.dirty = true;
}

// Called when user clicks Upload Photo 1 button
function onUploadFile(f) {
    $("#photo1prompt").text("Uploading...").show();
    $("#photo1img").hide();
    $("#photo1google").hide();
    var suffix = f.name.replace(/^.*\./, ".").toLowerCase();
    var fileName = window.place.RowKey + "-" + (new Date()).getTime().toString() + suffix;
    window.blobService.createBlockBlobFromBrowserFile('history-img', fileName, f, null,
        function (error, result, response) {
            if (!error) {
                $("#photo1prompt").text("Done.");
                ShowPhoto1("images/" + fileName);
            }
            else {
                $("#photo1prompt").text("Failed.");
            }
        });
    window.dirty = true;
}


//
// Photo2 - the slide show
//

function SetSlides(slideUrls) {
    for (var i = 0; i < slideUrls.length; i++) {
        var url = slideUrls[i];
        AddPhoto2(url, i == 0);
    }
}

// Called when user pastes a URL of a pic
function onAddPhoto2(url) {
    AddPhoto2(url, true);
    window.dirty = true;
}

var slideCount = 0;
// Append a photo to the gallery. select => Show in the enlarged pic.
function AddPhoto2(url, select) {
    if (!url || !(url.match(/\.(jpg|jpeg|png|gif)$/i))) { return; }
    var picBlob = url.replace(/^images\//, imgUrl);
    $("#photo2Gallery").append("<img id='slide{1}' src='{0}' title='Click to show at left' onclick='ShowPhoto2({1})' style='max-width:100px;max-height:100px;display:inline;'/> "
        .format(picBlob, ++slideCount));
    var gallery = $("#photo2Gallery")[0];
    gallery.lastElementChild.url = url;
    gallery.scrollTop = gallery.scrollHeight;
    if (select) {
        $("#photo2url")[0].value = "";
        ShowPhoto2(slideCount);
    }
}

// User clicks a thumbnail in the photo2 gallery; or has just added one.
// Display the selected pic in the larger box.
function ShowPhoto2(id) {
    var url = $("#slide" + id)[0].src;
    var picBlob = url.replace(/^images\//, imgUrl);
    $("#photo2img").show()[0].src = picBlob;
    $("#photo2prompt").hide();
    $("#photo2")[0].currentId = id;
}

// User has confirmed delete currently selected gallery pic.
function onDeletePhoto2() {
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


// User has selected one or more pic files to upload.
function onUploadFile2(ff) {
    var count = ff.length;
    $("#photo2prompt").text("Uploading " + count + "...").show();
    $("#photo2img").hide();
    // Compose the photo filename from the place key + datetime + index
    var fn = window.place.RowKey + "-" + (new Date()).getTime().toString().substr(2, 10);
    $.each(ff, function (i, file) {
        // Get .jpg, .png, etc:
        var suffix = file.name.replace(/^.*\./, ".").toLowerCase();
        var fileName = fn + "-" + i + suffix;
        // Really useful utility that uploads user file to blob:
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
                    // Append to visible gallery:
                    AddPhoto2("images/" + fileName, count <= 0);
                }
                else {
                    $("#photo2prompt").text("Failed.");
                }
            });
        window.dirty = true;

    });
}


// User clicked to delete an item. Show confirmation then do it.
function showDeleteDialog(action, thingToDelete) {
    var dialog = $("#deleteDialog");
    $("#thingToDelete").text(thingToDelete);
    dialog[0].action = action;
    dialog.show();
}

//
// Text editor
//

// User clicked one of the editing buttons (H, para, Bold, Italic, ...)
function onFormatDoc(sCmd, sValue, ui) {
    var x = document.getSelection().focusNode.parentElement;
    // Special characters can be inserted in title, subtitle or description.
    // Formatting commands can only be performed on the description text.
    if (sCmd == "InsertText" || isInNode(x, "text")) {
        document.execCommand(sCmd, ui, sValue);
    }
    x.focus();
}


// User clicked the button to link the text selection
function onCreateLink() {
    var selection = window.getSelection();
    var inLink = nodeIsInLink(selection.anchorNode);
    if (!isInNode(selection.anchorNode, "text") || selection.isCollapsed && !inLink) {
        window.alert("To create a link to another web page, first select a phrase in the text.");
        return;
    }

    // Are we editing an existing link?
    if (inLink) {
        // Expand the selection to the whole link:
        window.getSelection().removeAllRanges();
        var range = document.createRange();
        range.selectNode(inLink);
        window.getSelection().addRange(range);
        $("#linkRef").value = inLink.href;
    } else {
        // New link. Check if it's the name of another place.
        var phrase = window.getSelection().toString();
        var place = placeFromTitle(phrase);
        if (place) {
            $("#linkRef")[0].value = "./?place=" + place;
        }
    }

    $("#linkRemoveOption")[0].style.display = (inLink ? "block" : "none");
    var jLinkDialog = $("#linkDialog");
    // Hang on to the existing user text selection.
    // The dialog is a convenient place to attach it:
    jLinkDialog[0].savedSelection = saveSelection();
    jLinkDialog.show();

    // Select the link text in the dialog:
    $("#linkRef").select();
}
// User has closed the link dialog:
function CompleteCreateLink() {
    var jLinkDialog = $("#linkDialog");
    jLinkDialog.hide();
    // Select again the text that was selected before the dialog:
    restoreSelection(jLinkDialog[0].savedSelection);
    var href = $("#linkRef")[0].value;
    var selection = window.getSelection();
    if (href.length > 5 && !selection.isCollapsed && isInNode(selection.anchorNode, "text")) {
        document.execCommand("CreateLink", false, href);
        // Links will all open in a new window:
        $("#text a").attr("target", "_blank");
        // Tooltip is the URL:
        $("#text a").each(function (i, e) { e.title = e.href; });
        // Clean up the dialog, as we will reuse it:
        $("#linkRef")[0].value = "";
        window.dirty = true;
    }
}
// User clicked Remove in the link dialog
function CompleteRemoveLink() {
    var jLinkDialog = $("#linkDialog");
    jLinkDialog.hide();
    restoreSelection(jLinkDialog[0].savedSelection);
    if (isInNode(window.getSelection().anchorNode, "text")) {
        document.execCommand("Unlink");
    }
}


// Keep the user's text selection while we display a dialog
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

// Restore the user's text selection
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

// Selected text is within an existing link
function nodeIsInLink(n) {
    if (!n) return null;
    if (n.nodeName == "A") return n;
    return nodeIsInLink(n.parentNode);
}




//
// Save edited place
//

var fixLinks = new RegExp(sourceUrl, "g");
/// Get bits of data from form, prep to saving.
function gatherToSave() {
    var s = {};
    s.PartitionKey = "p1"; // TODO Make dependent on region.
    s.RowKey = "" + window.place.RowKey; // ensure string
    s.Title = $("#title")[0].value.trim().replace(/'/, "&#39;").replace(/"/, "&quot;");
    s.Subtitle = $("#subtitle")[0].value.trim();
    s.Year = $("#year")[0].value.trim();
    s.Postcode = $("#postcode")[0].value.trim();
    s.Tags = $("#tags")[0].value.trim();
    s.Zoom = ($("#zoom")[0].checked ? "1" : "0");
    s.Text = $("#text").html().replace(fixLinks, "./"); // Links to other places in Map.
    var loc = window.map.getPinCenter();
    s.Longitude = loc.longitude.toFixed(6);
    s.Latitude = loc.latitude.toFixed(6);
    s.Pic1 = window.place.Pic1 || ""; // ensure not undefined

    s.Pic2 = "";
    $("#photo2Gallery img").each(function (ix, img) {
        s.Pic2 += (ix > 0 ? ';' : '') + img.url.replace(imgUrl, "images/");
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

// User clicked Save
function onSavePlace() {
    if (!window.userName) {
        window.alert("You need to sign in before you can save your edits.");
        signin();
        return;
    }
    var s = gatherToSave();
    if (s.Text.length > 64000) {
        window.alert("The description is too long. Limit is 64k.");
        return;
    }
    if (!s.Title) {
        window.alert("Can't save yet: Enter a title in the pink box.");
        return;
    }
    appInsights.trackEvent("save", { title: s.Title, user: window.userName }, {});

    var jsn = JSON.stringify(s);
    fetch(apiUrl + "updateplace?code=" + window.keys.Client_UpdatePlace_FK, 
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
            }
            else { throw ("" + r.status + " " + r.statusText); }
        })
        .catch(function (error) {
            if (error.match(/401/)) {
                if (window.confirm("You need to sign in before you can save your edits. Click OK to sign in.")) {
                    signin();
                }
            }
            else window.alert("Failed to save. Try again later, and/or complain to alan@cameronwills.org. \n" + error);
        })
        ;
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



// Find out who the user is
$(document).ready(function () {
    getUserName();
    if (!isAdvancedBrowser) {
        $("body").html("<div style='position:fixed;top:100px;font-size:large;font-weight:bold;margin:10px;'>Sorry - This form doesn't work on your browser. Please complain to Alan.</div>");
        appInsights.trackEvent("old browser");
    }
});

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
        url: apiUrl + "test", xhrFields: { withCredentials: true }, complete: function (data, status) {
            var headers = data && data.responseJSON ? data.responseJSON.headers : {};
            var n = headers["x-ms-client-principal-name"] || null;
            setUserName(n);
            setCookie("username", n, 1000);
            var idp = headers["x-ms-client-principal-idp"] || "";
            if (idp) {
                setCookie("useridp", idp, 1000);
            }
        }
    });
}

function setLengthColour(jqtext) {
    jqtext.css("background-color", (jqtext.html().length > 64000) ? "pink" : "white");
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



// List of other places in current zone.
// Used to help make links from one place to another.
function getAllPlaces() {
    window.places = {};
    var fetchApi = apiUrl + "places?fields=RowKey,Title";
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

// Find a place with a name that looks like this
function placeFromTitle(title) {
    var cf = comparable(title);
    return window.places[cf];
}


