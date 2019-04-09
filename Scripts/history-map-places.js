//
// Keyboard search on left-side index of places.
// As user types a place name, index scrolls. Punctuation ignored.
// Up and down keys work. Hit Enter to open selected place.
// After a few seconds inactivity, matching restarts at beginning of name.
// 

window.khighlit = null; // Current scrolled-to but not opened place.
var keystrokeTimestamp = null;  // Most recent keystroke
var kstring = ""; // Name as typed so far
var kselected = -1;


// On doc load, set event handler:
$(function(){
    document.body.onkeyup = keyup;
});


// Called on key up anywhere in doc except search entry:
function keyup(e) {
    var t = new Date().getTime();
    var category = "fail";
    if (e.key.length == 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
        var ch = e.key.toLocaleLowerCase();
        if (ch >= "a" && ch <= "z") {
            if (keystrokeTimestamp && t - keystrokeTimestamp < 2000) {
                kstring += ch;
            }
            else {
                kstring = ch;
            }
        }
        if (e.cancelBubble != null) e.cancelBubble = true;
        var toSelect = null;
        for (var i in window.orderedList) {
            if (orderedList[i].cf.localeCompare(kstring) >= 0) {
                kselected = orderedList[i].id;
                toSelect = "#h" + kselected; // ids assigned to UI lines in index
                break;
            }
        }
        if (toSelect) {
            if (window.khighlit) { window.khighlit.removeClass("keySelectedItem"); }
            window.khighlit = $(toSelect);
            window.khighlit[0].scrollIntoView(); // [0] unwraps dom object from JQuery
            window.khighlit.addClass("keySelectedItem"); // highlight selection
            category = "found";
        }
        else { category = "not found"; }
        keystrokeTimestamp = t;
    }
    else if (kselected >= 0 && e.keyCode == 27) { // esc
        if (window.khighlit) { window.khighlit.removeClass("keySelectedItem"); }
        keystrokeTimestamp = null;
        kstring = "";
        kselected = -1;
    } else if (e.keyCode == 38 || e.keyCode == 40) { // arrows
        if (window.khighlit) {
            window.khighlit.removeClass("keySelectedItem");
            var toSelect = e.keyCode == 40 ? window.khighlit.next() : window.khighlit.prev();
            if (toSelect) {
                window.khighlit = toSelect;
                window.khighlit[0].scrollIntoView();
                window.khighlit.addClass("keySelectedItem");
                kselected = toSelect[0].id.substr(1);
                category = "arrow";
            }
            keystrokeTimestamp = t;
        }
    } else if (kselected >= 0 && e.keyCode < 16) { // Enter or Tab keys
        go(kselected, true); // Show the selected item
        keystrokeTimestamp = null;
        kstring = "";
        kselected = -1;
        category = "go";
    }

    // Monitor stats of user behaviour:
    appInsights.trackEvent("key", { "category": category }, {});
}

// Highlight place on the left-side index.
// item == null -> just clear the selection
// fromList : user clicked the place on the index, not the map
function selectOnList(item, fromList) {
    // Clear keystroke-match highlight:
    if (window.khighlit) { window.khighlit.removeClass("keySelectedItem"); }
    // Clear highlight of currently showing place:
    if (window.selectedItem) {
        $("#" + window.selectedItem).removeClass("selectedItem");
    }
    if (item) {
        window.selectedItem = "h" + item;
        var jItem = $("#" + window.selectedItem);
        jItem.addClass("selectedItem");
        if (!fromList) {
            // User clicked on map, so need to scroll index.
            jItem[0].scrollIntoView();
            //var offset = jItem.offset();
            //$("#houselist").animate({scrollTop:offset.top-20});
        }
    }
}