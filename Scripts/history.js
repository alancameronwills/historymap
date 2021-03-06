// Common code for history map index.htm and edit.htm

var azureWS = "https://moylgrove-history.azurewebsites.net/";
var imgUrl = azureWS + "images/";
var apiUrl = azureWS + "api/";
var sourceUrl = azureWS + "h/";
var avUrl = azureWS + "av/";      // Audio

function g(id) {return document.getElementById(id);}

// Get query parameters
location.queryParameters = {};
location.search.substr(1).split("&").forEach(function (pair) {
    if (pair === "") return;
    var parts = pair.split("=");
    location.queryParameters[parts[0]] = parts[1] &&
        decodeURIComponent(parts[1].replace(/\+/g, " "));
});

// Placeholder replaced in some scripts
if (!onKeysArrived) {function onKeysArrived(){}}

// On initialization, get API keys
$(function() {
    $.ajax({
        url: 'https://moylgrove-history.azurewebsites.net/api/Keys?code=5gJHMkN6fOy5OaQkRslNe884xX2Hlb4kMGavabHETYxT5nNsbvQm6A==',
        type: 'GET',
        contentType: 'application/json',
        success: function (data, e, r) {
            window.keys = data;
            doLoadMap();
            onKeysArrived();
        }
    });
});

// For searching and sorting place names
// Remove punctuation, spacing, Welsh chars, so that Tŷ Wylan == Ty-wylan
function comparable(title) {
    return title.toLocaleLowerCase().replace(/[- '",]+/g, "").replace(/^the/, ""
        .replace(/[âêîôûŵŷ]/g, function (c) { return { "â": "a", "ê": "e", "î": "i", "ô": "o", "û": "u", "ŵ": "w", "ŷ": "y" }[c]; }));
}

/// Default 30 days
function setCookie(cname, cvalue, exdays) {
    if (!exdays) exdays = 30;
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    document.cookie = cname + "=" + cvalue + "; expires=" + d.toUTCString();
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

// Determines whether one element is contained in another
function isInNode(element, nodeId) {
    if (!element) return false;
    if (!element.id) return isInNode(element.parentElement, nodeId);
    return element.id == nodeId;
}


function noPropagate(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    else {
        e.cancelBubble = true;
    }
}

function trimQuotes(s) {
    if (typeof s !== "string" || s.length == 0) return "";
    return s.replace(/^"|"$/gm, '');
}


if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };
}

function hashCode(s) {
    var hash = 0, i, chr;
    if (s.length === 0) return hash;
    for (i = 0; i < s.length; i++) {
        chr = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

function p(x) {
    if (x) return x._;
    else return null;
}


var isAdvancedBrowser = function () {
    var div = document.createElement('div');
    return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
}();


// Regions where density of places is high, so that going there should zoom in closer.
// Currently this is just the centre of Moylgrove. Need to make this a more dynamic thing in go().
function zoomed(lat, long) {
    var f1lat = 52.068478, f1long = -4.747869, f2lat = 52.065769, f2long = -4.753887, diameter = 0.008579508;
    return Math.sqrt(Math.pow(lat - f1lat, 2) + Math.pow(long - f1long, 2))
        + Math.sqrt(Math.pow(lat - f2lat, 2) + Math.pow(long - f2long, 2))
        < diameter;
}


function makePlace(t) {
    var place = {
        title: trimQuotes(t.Title),
        subtitle: t.Subtitle,
        id: t.RowKey,
        postcode: t.Postcode || "",
        location: window.map.makePosition(t.Latitude, t.Longitude),
        zoom: t.Zoom ? (t.Zoom > 2 ? 1*t.Zoom : t.Zoom ) : 0,
        pic1: t.Pic1 || "",
        pic2: t.Pic2 || "",
        text: t.Text,
        year: "" + t.Year,
        principal: t.Principal,
        deleted: !!t.Deleted,
        updated: new Date(t.Updated || "2010-01-01T00:00:00.000Z")
    };
    // For alphabetic sorting:
    place.cf = comparable(place.title);
    return place;
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

