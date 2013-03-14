/**
 * MoreBookmarksToolbar namespace.
 */
if ("undefined" == typeof(MoreBookmarksToolbar)) {
  var MoreBookmarksToolbar = {};
}

MoreBookmarksToolbar.BrowserOverlay = {
	addButtons : function(e) {
		//alert("adding buttons..."); // debugging

		// get the Extra Bookmarks folder
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
		for (var i = 0; i < root.childCount; i ++) {
		  var node = root.getChild(i);
			if (node.type === node.RESULT_TYPE_FOLDER) {
				// FUTURE: Don't hardcode this.
				// TODO: Add this folder if it doesn't exist (with link to me?)
				if (node.title === "More Bookmarks Toolbar") {
					itemId = node.itemId;
					break;
				}
			}
		}

		// Close a container after using it!
		root.containerOpen = false;
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
