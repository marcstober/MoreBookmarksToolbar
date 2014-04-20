// MoreBookmarksToolbar namespace
if ("undefined" == typeof(MoreBookmarksToolbar)) {
  var MoreBookmarksToolbar = {};
}

MoreBookmarksToolbar.BrowserOverlay = {
	addButtons: function(e) {

		var container = document.getElementById("morebookmarkstoolbar-Toolbar");

		// get the More Bookmarks folder
		var folderUri = this.getFolderUri();
		console.log(folderUri);

		var ptg = new PlacesToolbarGeneric(folderUri, container);
	},

	getFolderItems: function (folderId)
	{
		var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                               .getService(Components.interfaces.nsINavHistoryService);
		var options = historyService.getNewQueryOptions();
		var query = historyService.getNewQuery();
		query.setFolders([folderId], 1);

		var queryString = historyService.queriesToQueryString([query], 1, options); // debugging

		return historyService.executeQuery(query, options);
	},

	// This seems like a lot of code to find one item?
	// TODO: see how that other extension does it
	getFolderUri: function () {

		var bmsvc = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                      .getService(Components.interfaces.nsINavBookmarksService);
		var menuFolder = bmsvc.bookmarksMenuFolder; // Bookmarks menu folder

		var result = this.getFolderItems(menuFolder);

		var root = result.root;
		root.containerOpen = true;
		// iterate over immediate children of this folder
		var uri = null;
		var title = "More Bookmarks Toolbar"; // TODO const?
		for (var i = 0; i < root.childCount; i ++) {
		  var node = root.getChild(i);
			if (node.type === node.RESULT_TYPE_FOLDER) {
				if (node.title === title) {
					console.log(node); // debugging
					uri = node.uri;
					break;
				}
			}
		}

		// Close a container after using it!
		root.containerOpen = false;

		// Add folder if doesn't exist, with link to extension's home page.
		if (uri === null) {
			folderId = bmsvc.createFolder(
				bmsvc.bookmarksMenuFolder,
				title,
				bmsvc.DEFAULT_INDEX);

			// create an nsIURI for the URL to be bookmarked.
			var bookmarkURI = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService)
                .newURI("http://www.marcstober.com/blog/more-bookmarks-toolbar/", null, null);

			var bookmarkId = bmsvc.insertBookmark(
				folderId, bookmarkURI, bmsvc.DEFAULT_INDEX,
				"More Bookmarks Toolbar Homepage");    // The title of the bookmark.

			// TODO: This feels like a hack.
			uri = "place:folder=" + folderId;
		}

		return uri;
	},
};

// Why doesn't the first one work?
//window.addEventListener("load", MoreBookmarksToolbar.BrowserOverlay.addButtons);
window.addEventListener("load", function(e) 
{
	MoreBookmarksToolbar.BrowserOverlay.addButtons();
});
