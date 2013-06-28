/**
 * MoreBookmarksToolbar namespace.
 */
if ("undefined" == typeof(MoreBookmarksToolbar)) {
  var MoreBookmarksToolbar = {};
}

MoreBookmarksToolbar.BrowserOverlay = {
	addButtons : function(e) {
		//alert("adding buttons..."); // debugging

		// get the More Bookmarks folder
		var folderId = this.getFolderId();

		var folderItems = this.getFolderItems(folderId);
		var root = folderItems.root;
		root.containerOpen = true;
		for (var i = 0; i < root.childCount; i++) {
			var node = root.getChild(i);
			this.addButton(node);
		}
		root.containerOpen = false;
	},

	// placesNode is a nsINavHistoryResultNode
	addButton: function(placesNode) {
		var container = document.getElementById("morebookmarkstoolbar-DynButtonContainer");
		var newButton = document.createElement("toolbarbutton");
		newButton.setAttribute("label", placesNode.title);
		newButton.setAttribute("class", "bookmark-item");
		newButton._placesNode = placesNode;
		container.appendChild(newButton);
	},

	getFolderItems: function (folderId)
	{
		var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                               .getService(Components.interfaces.nsINavHistoryService);
		var options = historyService.getNewQueryOptions();
		var query = historyService.getNewQuery();
		query.setFolders([folderId], 1);

		var queryString = historyService.queriesToQueryString([query], 1, options); // debugging
		//alert(queryString); // debugging

		return historyService.executeQuery(query, options);
	},

	// This seems like a lot of code to find one item?
	// TODO: see how that other extension does it
	getFolderId: function () {

		var bmsvc = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                      .getService(Components.interfaces.nsINavBookmarksService);
		var menuFolder = bmsvc.bookmarksMenuFolder; // Bookmarks menu folder

		var result = this.getFolderItems(menuFolder);

		//alert("menuFolder.root.childCount=" + result.root.childCount);

		var root = result.root;
		root.containerOpen = true;
		// iterate over immediate children of this folder
		var itemId = -1;
		var title = "More Bookmarks Toolbar"; // TODO const?
		for (var i = 0; i < root.childCount; i ++) {
		  var node = root.getChild(i);
			if (node.type === node.RESULT_TYPE_FOLDER) {
				if (node.title === title) {
					itemId = node.itemId;
					break;
				}
			}
		}

		// Close a container after using it!
		root.containerOpen = false;

		// Add folder if doesn't exist, with link to extension's home page.
		if (itemId === -1) {
			itemId = bmsvc.createFolder(
				bmsvc.bookmarksMenuFolder,
				title,
				bmsvc.DEFAULT_INDEX);

			// create an nsIURI for the URL to be bookmarked.
			var bookmarkURI = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService)
                .newURI("http://www.marcstober.com/blog/more-bookmarks-toolbar/", null, null);

			var bookmarkId = bmsvc.insertBookmark(
				itemId, bookmarkURI, bmsvc.DEFAULT_INDEX,
				"More Bookmarks Toolbar Homepage");    // The title of the bookmark.
		}

		return itemId;
	},
	
	navigate: function(e) {
		// FUTURE: figure out exactly how built-in Bookmarks Toolbar works
		openUILink(e.target._placesNode.uri, e);
	}
};

// Why doesn't the first one work?
//window.addEventListener("load", MoreBookmarksToolbar.BrowserOverlay.addButtons);
window.addEventListener("load", function(e) 
{
	MoreBookmarksToolbar.BrowserOverlay.addButtons();
});
