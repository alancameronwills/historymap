# History Map client code
[History Map](https://www.moylgrove.wales/the-history-map) client for Moylgrove and beyond.

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

