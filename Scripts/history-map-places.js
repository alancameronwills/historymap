//
// Keyboard search on left-side index of places.
// As user types a place name, index scrolls. Punctuation ignored.
// Up and down keys work. Hit Enter to open selected place.
// After a few seconds inactivity, matching restarts at beginning of name.
//

class PlaceList {
    constructor() {
        this._highlighted = null;   // was window.khighlit
        this._keystrokeTime = null; // was keystrokeTimestamp
        this._kstring = "";         // was kstring
        this._kselected = -1;       // was kselected
        this._selectedItem = null;  // was window.selectedItem

        $(() => {
            document.body.onkeyup = (e) => this._keyup(e);
        });
    }

    // Called on key up anywhere in doc except search entry:
    _keyup(e) {
        var t = new Date().getTime();
        var category = "fail";
        if (e.key.length == 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
            var ch = e.key.toLocaleLowerCase();
            if (ch >= "a" && ch <= "z") {
                if (this._keystrokeTime && t - this._keystrokeTime < 2000) {
                    this._kstring += ch;
                }
                else {
                    this._kstring = ch;
                }
            }
            if (e.cancelBubble != null) e.cancelBubble = true;
            var toSelect = null;
            for (var i in window.orderedList) {
                if (orderedList[i].cf.localeCompare(this._kstring) >= 0) {
                    this._kselected = orderedList[i].id;
                    toSelect = "#h" + this._kselected; // ids assigned to UI lines in index
                    break;
                }
            }
            if (toSelect) {
                if (this._highlighted) { this._highlighted.removeClass("keySelectedItem"); }
                this._highlighted = $(toSelect);
                this._highlighted[0].scrollIntoView(); // [0] unwraps dom object from JQuery
                this._highlighted.addClass("keySelectedItem"); // highlight selection
                category = "found";
            }
            else { category = "not found"; }
            this._keystrokeTime = t;
        }
        else if (this._kselected >= 0 && e.keyCode == 27) { // esc
            if (this._highlighted) { this._highlighted.removeClass("keySelectedItem"); }
            this._keystrokeTime = null;
            this._kstring = "";
            this._kselected = -1;
        } else if (e.keyCode == 38 || e.keyCode == 40) { // arrows
            if (this._highlighted) {
                this._highlighted.removeClass("keySelectedItem");
                var toSelect = e.keyCode == 40 ? this._highlighted.next() : this._highlighted.prev();
                if (toSelect) {
                    this._highlighted = toSelect;
                    this._highlighted[0].scrollIntoView();
                    this._highlighted.addClass("keySelectedItem");
                    this._kselected = toSelect[0].id.substr(1);
                    category = "arrow";
                }
                this._keystrokeTime = t;
            }
        } else if (this._kselected >= 0 && e.keyCode < 16) { // Enter or Tab keys
            go(this._kselected, true); // Show the selected item
            this._keystrokeTime = null;
            this._kstring = "";
            this._kselected = -1;
            category = "go";
        }

        // Monitor stats of user behaviour:
        appInsights.trackEvent("key", { "category": category }, {});
    }

    // Highlight place on the left-side index.
    // id == null -> just clear the selection
    // fromList : user clicked the place on the index, not the map
    select(id, fromList) {
        // Clear keystroke-match highlight:
        if (this._highlighted) { this._highlighted.removeClass("keySelectedItem"); }
        // Clear highlight of currently showing place:
        if (this._selectedItem) {
            $("#" + this._selectedItem).removeClass("selectedItem");
        }
        if (id) {
            this._selectedItem = "h" + id;
            var jItem = $("#" + this._selectedItem);
            jItem.addClass("selectedItem");
            if (!fromList) {
                // User clicked on map, so need to scroll index.
                jItem[0].scrollIntoView();
            }
        }
    }

    show() {
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
            var isPrincipal = !!item.principal;

            listContent += "<div id='h{0}' {2} onClick='go(\"{0}\",true)'>{1}</div>".
                format(item.id, item.title, (isPrincipal ? "class='principal'" : isInteresting ? "class='interesting'" : ""));
        }
        $("#houselist").html(listContent);
    }
}

window.placeList = new PlaceList();
