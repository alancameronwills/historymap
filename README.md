# History Map client code
[History Map](https://www.moylgrove.wales/the-history-map) client for Moylgrove and beyond. The History Map lets people add notes and photos about places on a map. It also shows census data for people who lived in the houses in the 19th century.  The idea is to provide a tool for communities who want to build a picture of the lives of their predecessors. 

An accompanying [phone app](http://bit.ly/moylgrovewalk) shows you the notes about the nearest place as you walk around the village.

## Architecture

The Map app is a web page. Most of the logic is in the client end, written in JavaScript.  
It uses the [Bing map service](https://docs.microsoft.com/en-us/bingmaps/v8-web-control/creating-and-hosting-map-controls/?toc=%2Fen-us%2Fbingmaps%2Fv8-web-control%2FTOC.json&bc=%2Fen-us%2FBingMaps%2Fbreadcrumb%2Ftoc.json), which lets you put dots (and other things) on the map. I use Bing because it provides more detailed aerial shots than Google, and also provides the option of Ordnance Survey maps.
The page and data are served from an [Azure Functions service](https://docs.microsoft.com/en-gb/azure/azure-functions/), and the data is kept in [Azure Storage](https://docs.microsoft.com/en-us/azure/storage/) – blobs for the code and photos, and tables for the text etc associated with each place on the map. I use Azure Functions and Storage rather than a conventional website service because they charge per use rather than per month. Our usage is very low, so it’s only pennies!

![Client and server](img/README-1.png)

When the page loads, it requests the script from the Bing maps service. When that has loaded, the place index is requested, and the dots are put on the map. Both the initial page request and the place index are served by Azure Functions.

At present, the notes for each house are text without embedded images, and all the text for all places is downloaded with the index on startup. Photos and census entries are displayed separately and are requested only when the user clicks a place.


## Interesting files

Main map page: 
* index.htm
* Scripts/history-map.js
* Scripts/history.js  -- some shared functions
* css/history.css

Place editor page:
* ediitor.htm
* Scripts/history-edit.js
* css/history-edit.css

Walkabout app:
* walk.htm -- layout, scripts and styles all in one

Other files:
* dump.htm - a page that shows all the content in one long page. Useful for local historians to print the whole thing off on paper and pore over it.
* Auth.htm, sign*.htm - to do with identifying users. I think one of them is no longer used.
* favicon*.* - the icon that shows in the tabs. Different browsers use different conventions.
* Scripts/azure* - APIs for storage access

## To edit and test

* Download all the files to a PC and put them under C:\inetpub\wwwroot. 
* In a browser on the same machine, run http://localhost.
  * If no response, press Windows key, type *Windows features* and enable **Internet Information Services**
* To edit, run [VSCode](https://code.visualstudio.com/) in administrator mode.  
  Edit the files under \inetpub directly and test //localhost.
* When done, upload changed files to a branch here and create a pull request.

