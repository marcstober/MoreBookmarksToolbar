// Adapted from Firefox 28 source code: 
// http://hg.mozilla.org/releases/mozilla-release/file/5f7c149b07ba/browser/components/places/content/browserPlacesViews.js
// Notice from original:
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

//Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
//Components.utils.import("resource://gre/modules/Services.jsm");

function PlacesToolbarGeneric(aPlace, toolbarElt) {
  let startTime = Date.now();
  // Add some smart getters for our elements.
  let thisView = this;
  [
    ["_viewElt",              "PlacesToolbar"],
    ["_rootElt",              "PlacesToolbarItems"],
    ["_dropIndicator",        "PlacesToolbarDropIndicator"],
    ["_chevron",              "PlacesChevron"],
    ["_chevronPopup",         "PlacesChevronPopup"]
  ].forEach(function (elementGlobal) {
    let [name, id] = elementGlobal;
    thisView.__defineGetter__(name, function () {
      let element = toolbarElt.getElementsByClassName(id)[0];
      if (!element)
        return null;

      delete thisView[name];
      return thisView[name] = element;
    });
  });

  this._viewElt._placesView = this;

  this._addEventListeners(this._viewElt, this._cbEvents, false);
  this._addEventListeners(this._rootElt, ["popupshowing", "popuphidden"], true);
  this._addEventListeners(this._rootElt, ["overflow", "underflow"], true);
  this._addEventListeners(window, ["resize", "unload"], false);

  // If personal-bookmarks has been dragged to the tabs toolbar,
  // we have to track addition and removals of tabs, to properly
  // recalculate the available space for bookmarks.
  // TODO (bug 734730): Use a performant mutation listener when available.
  if (this._viewElt.parentNode.parentNode == document.getElementById("TabsToolbar")) {
    this._addEventListeners(gBrowser.tabContainer, ["TabOpen", "TabClose"], false);
  }

  PlacesViewBase.call(this, aPlace);
}


PlacesToolbarGeneric.prototype = {
  __proto__: PlacesViewBase.prototype,

  _cbEvents: ["dragstart", "dragover", "dragexit", "dragend", "drop",
              "mousemove", "mouseover", "mouseout"],

  QueryInterface: function PT_QueryInterface(aIID) {
    if (aIID.equals(Ci.nsIDOMEventListener) ||
        aIID.equals(Ci.nsITimerCallback))
      return this;

    return PlacesViewBase.prototype.QueryInterface.apply(this, arguments);
  },

  uninit: function PT_uninit() {
    this._removeEventListeners(this._viewElt, this._cbEvents, false);
    this._removeEventListeners(this._rootElt, ["popupshowing", "popuphidden"],
                               true);
    this._removeEventListeners(this._rootElt, ["overflow", "underflow"], true);
    this._removeEventListeners(window, ["resize", "unload"], false);
    this._removeEventListeners(gBrowser.tabContainer, ["TabOpen", "TabClose"], false);

    PlacesViewBase.prototype.uninit.apply(this, arguments);
  },

  _openedMenuButton: null,
  _allowPopupShowing: true,

  _rebuild: function PT__rebuild() {
    // Clear out references to existing nodes, since they will be removed
    // and re-added.
    if (this._overFolder.elt)
      this._clearOverFolder();

    this._openedMenuButton = null;
    while (this._rootElt.hasChildNodes()) {
      this._rootElt.removeChild(this._rootElt.firstChild);
    }

    let cc = this._resultNode.childCount;
    for (let i = 0; i < cc; ++i) {
      this._insertNewItem(this._resultNode.getChild(i), null);
    }

    if (this._chevronPopup.hasAttribute("type")) {
      // Chevron has already been initialized, but since we are forcing
      // a rebuild of the toolbar, it has to be rebuilt.
      // Otherwise, it will be initialized when the toolbar overflows.
      this._chevronPopup.place = this.place;
    }
  },

  _insertNewItem:
  function PT__insertNewItem(aChild, aBefore) {
    this._domNodes.delete(aChild);

    let type = aChild.type;
    let button;
    if (type == Ci.nsINavHistoryResultNode.RESULT_TYPE_SEPARATOR) {
      button = document.createElement("toolbarseparator");
    }
    else {
      button = document.createElement("toolbarbutton");
      button.className = "bookmark-item";
      button.setAttribute("label", aChild.title);
      let icon = aChild.icon;
      if (icon)
        button.setAttribute("image", icon);

      if (PlacesUtils.containerTypes.indexOf(type) != -1) {
        button.setAttribute("type", "menu");
        button.setAttribute("container", "true");

        if (PlacesUtils.nodeIsQuery(aChild)) {
          button.setAttribute("query", "true");
          if (PlacesUtils.nodeIsTagQuery(aChild))
            button.setAttribute("tagContainer", "true");
        }
        else if (PlacesUtils.nodeIsFolder(aChild)) {
          PlacesUtils.livemarks.getLivemark(
            { id: aChild.itemId },
            function (aStatus, aLivemark) {
              if (Components.isSuccessCode(aStatus)) {
                button.setAttribute("livemark", "true");
                this.controller.cacheLivemarkInfo(aChild, aLivemark);
              }
            }.bind(this)
          );
        }

        let popup = document.createElement("menupopup");
        popup.setAttribute("placespopup", "true");
        button.appendChild(popup);
        popup._placesNode = PlacesUtils.asContainer(aChild);
        popup.setAttribute("context", "placesContext");

        this._domNodes.set(aChild, popup);
      }
      else if (PlacesUtils.nodeIsURI(aChild)) {
        button.setAttribute("scheme",
                            PlacesUIUtils.guessUrlSchemeForUI(aChild.uri));
      }
    }

    button._placesNode = aChild;
    if (!this._domNodes.has(aChild))
      this._domNodes.set(aChild, button);

    if (aBefore)
      this._rootElt.insertBefore(button, aBefore);
    else
      this._rootElt.appendChild(button);
  },

  _updateChevronPopupNodesVisibility:
  function PT__updateChevronPopupNodesVisibility() {
    for (let i = 0, node = this._chevronPopup._startMarker.nextSibling;
         node != this._chevronPopup._endMarker;
         i++, node = node.nextSibling) {
      node.hidden = this._rootElt.childNodes[i].style.visibility != "hidden";
    }
  },

  _onChevronPopupShowing:
  function PT__onChevronPopupShowing(aEvent) {
    // Handle popupshowing only for the chevron popup, not for nested ones.

    if (aEvent.target != this._chevronPopup)
      return;

    if (!this._chevron._placesView)
      this._chevron._placesView = new PlacesMenu(aEvent, this.place);

    this._updateChevronPopupNodesVisibility();
  },

  handleEvent: function PT_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "unload":
        this.uninit();
        break;
      case "resize":
        // This handler updates nodes visibility in both the toolbar
        // and the chevron popup when a window resize does not change
        // the overflow status of the toolbar.
        this.updateChevron();
        break;
      case "overflow":
        if (aEvent.target != aEvent.currentTarget)
          return;

        // Ignore purely vertical overflows.
        if (aEvent.detail == 0)
          return;

        // Attach the popup binding to the chevron popup if it has not yet
        // been initialized.
        if (!this._chevronPopup.hasAttribute("type")) {
          this._chevronPopup.setAttribute("place", this.place);
          this._chevronPopup.setAttribute("type", "places");
        }
        this._chevron.collapsed = false;
        this.updateChevron();
        break;
      case "underflow":
        if (aEvent.target != aEvent.currentTarget)
          return;

        // Ignore purely vertical underflows.
        if (aEvent.detail == 0)
          return;

        this.updateChevron();
        this._chevron.collapsed = true;
        break;
      case "TabOpen":
      case "TabClose":
        this.updateChevron();
        break;
      case "dragstart":
        this._onDragStart(aEvent);
        break;
      case "dragover":
        this._onDragOver(aEvent);
        break;
      case "dragexit":
        this._onDragExit(aEvent);
        break;
      case "dragend":
        this._onDragEnd(aEvent);
        break;
      case "drop":
        this._onDrop(aEvent);
        break;
      case "mouseover":
        this._onMouseOver(aEvent);
        break;
      case "mousemove":
        this._onMouseMove(aEvent);
        break;
      case "mouseout":
        this._onMouseOut(aEvent);
        break;
      case "popupshowing":
        this._onPopupShowing(aEvent);
        break;
      case "popuphidden":
        this._onPopupHidden(aEvent);
        break;
      default:
        throw "Trying to handle unexpected event.";
    }
  },

  updateChevron: function PT_updateChevron() {
    // If the chevron is collapsed there's nothing to update.
    if (this._chevron.collapsed)
      return;

    // Update the chevron on a timer.  This will avoid repeated work when
    // lot of changes happen in a small timeframe.
    if (this._updateChevronTimer)
      this._updateChevronTimer.cancel();

    this._updateChevronTimer = this._setTimer(100);
  },

  _updateChevronTimerCallback: function PT__updateChevronTimerCallback() {
    let scrollRect = this._rootElt.getBoundingClientRect();
    let childOverflowed = false;
    for (let i = 0; i < this._rootElt.childNodes.length; i++) {
      let child = this._rootElt.childNodes[i];
      // Once a child overflows, all the next ones will.
      if (!childOverflowed) {
        let childRect = child.getBoundingClientRect();
        childOverflowed = this.isRTL ? (childRect.left < scrollRect.left)
                                     : (childRect.right > scrollRect.right);
                                      
      }
      child.style.visibility = childOverflowed ? "hidden" : "visible";
    }

    // We rebuild the chevron on popupShowing, so if it is open
    // we must update it.
    if (this._chevron.open)
      this._updateChevronPopupNodesVisibility();
  },

  nodeInserted:
  function PT_nodeInserted(aParentPlacesNode, aPlacesNode, aIndex) {
    let parentElt = this._getDOMNodeForPlacesNode(aParentPlacesNode);
    if (parentElt == this._rootElt) {
      let children = this._rootElt.childNodes;
      this._insertNewItem(aPlacesNode,
        aIndex < children.length ? children[aIndex] : null);
      this.updateChevron();
      return;
    }

    PlacesViewBase.prototype.nodeInserted.apply(this, arguments);
  },

  nodeRemoved:
  function PT_nodeRemoved(aParentPlacesNode, aPlacesNode, aIndex) {
    let parentElt = this._getDOMNodeForPlacesNode(aParentPlacesNode);
    let elt = this._getDOMNodeForPlacesNode(aPlacesNode);

    // Here we need the <menu>.
    if (elt.localName == "menupopup")
      elt = elt.parentNode;

    if (parentElt == this._rootElt) {
      this._removeChild(elt);
      this.updateChevron();
      return;
    }

    PlacesViewBase.prototype.nodeRemoved.apply(this, arguments);
  },

  nodeMoved:
  function PT_nodeMoved(aPlacesNode,
                        aOldParentPlacesNode, aOldIndex,
                        aNewParentPlacesNode, aNewIndex) {
    let parentElt = this._getDOMNodeForPlacesNode(aNewParentPlacesNode);
    if (parentElt == this._rootElt) {
      // Container is on the toolbar.

      // Move the element.
      let elt = this._getDOMNodeForPlacesNode(aPlacesNode);

      // Here we need the <menu>.
      if (elt.localName == "menupopup")
        elt = elt.parentNode;

      this._removeChild(elt);
      this._rootElt.insertBefore(elt, this._rootElt.childNodes[aNewIndex]);

      // The chevron view may get nodeMoved after the toolbar.  In such a case,
      // we should ensure (by manually swapping menuitems) that the actual nodes
      // are in the final position before updateChevron tries to updates their
      // visibility, or the chevron may go out of sync.
      // Luckily updateChevron runs on a timer, so, by the time it updates
      // nodes, the menu has already handled the notification.

      this.updateChevron();
      return;
    }

    PlacesViewBase.prototype.nodeMoved.apply(this, arguments);
  },

  nodeAnnotationChanged:
  function PT_nodeAnnotationChanged(aPlacesNode, aAnno) {
    let elt = this._getDOMNodeForPlacesNode(aPlacesNode);
    if (elt == this._rootElt)
      return;

    // We're notified for the menupopup, not the containing toolbarbutton.
    if (elt.localName == "menupopup")
      elt = elt.parentNode;

    if (elt.parentNode == this._rootElt) {
      // Node is on the toolbar.

      // All livemarks have a feedURI, so use it as our indicator.
      if (aAnno == PlacesUtils.LMANNO_FEEDURI) {
        elt.setAttribute("livemark", true);

        PlacesUtils.livemarks.getLivemark(
          { id: aPlacesNode.itemId },
          function (aStatus, aLivemark) {
            if (Components.isSuccessCode(aStatus)) {
              this.controller.cacheLivemarkInfo(aPlacesNode, aLivemark);
              this.invalidateContainer(aPlacesNode);
            }
          }.bind(this)
        );
      }
    }
    else {
      // Node is in a submenu.
      PlacesViewBase.prototype.nodeAnnotationChanged.apply(this, arguments);
    }
  },

  nodeTitleChanged: function PT_nodeTitleChanged(aPlacesNode, aNewTitle) {
    let elt = this._getDOMNodeForPlacesNode(aPlacesNode);

    // There's no UI representation for the root node, thus there's
    // nothing to be done when the title changes.
    if (elt == this._rootElt)
      return;

    PlacesViewBase.prototype.nodeTitleChanged.apply(this, arguments);

    // Here we need the <menu>.
    if (elt.localName == "menupopup")
      elt = elt.parentNode;

    if (elt.parentNode == this._rootElt) {
      // Node is on the toolbar
      this.updateChevron();
    }
  },

  invalidateContainer: function PT_invalidateContainer(aPlacesNode) {
    let elt = this._getDOMNodeForPlacesNode(aPlacesNode);
    if (elt == this._rootElt) {
      // Container is the toolbar itself.
      this._rebuild();
      return;
    }

    PlacesViewBase.prototype.invalidateContainer.apply(this, arguments);
  },

  _overFolder: { elt: null,
                 openTimer: null,
                 hoverTime: 350,
                 closeTimer: null },

  _clearOverFolder: function PT__clearOverFolder() {
    // The mouse is no longer dragging over the stored menubutton.
    // Close the menubutton, clear out drag styles, and clear all
    // timers for opening/closing it.
    if (this._overFolder.elt && this._overFolder.elt.lastChild) {
      if (!this._overFolder.elt.lastChild.hasAttribute("dragover")) {
        this._overFolder.elt.lastChild.hidePopup();
      }
      this._overFolder.elt.removeAttribute("dragover");
      this._overFolder.elt = null;
    }
    if (this._overFolder.openTimer) {
      this._overFolder.openTimer.cancel();
      this._overFolder.openTimer = null;
    }
    if (this._overFolder.closeTimer) {
      this._overFolder.closeTimer.cancel();
      this._overFolder.closeTimer = null;
    }
  },

  /**
   * This function returns information about where to drop when dragging over
   * the toolbar.  The returned object has the following properties:
   * - ip: the insertion point for the bookmarks service.
   * - beforeIndex: child index to drop before, for the drop indicator.
   * - folderElt: the folder to drop into, if applicable.
   */
  _getDropPoint: function PT__getDropPoint(aEvent) {
    let result = this.result;
    if (!PlacesUtils.nodeIsFolder(this._resultNode))
      return null;

    let dropPoint = { ip: null, beforeIndex: null, folderElt: null };
    let elt = aEvent.target;
    if (elt._placesNode && elt != this._rootElt &&
        elt.localName != "menupopup") {
      let eltRect = elt.getBoundingClientRect();
      let eltIndex = Array.indexOf(this._rootElt.childNodes, elt);
      if (PlacesUtils.nodeIsFolder(elt._placesNode) &&
          !PlacesUtils.nodeIsReadOnly(elt._placesNode)) {
        // This is a folder.
        // If we are in the middle of it, drop inside it.
        // Otherwise, drop before it, with regards to RTL mode.
        let threshold = eltRect.width * 0.25;
        if (this.isRTL ? (aEvent.clientX > eltRect.right - threshold)
                       : (aEvent.clientX < eltRect.left + threshold)) {
          // Drop before this folder.
          dropPoint.ip =
            new InsertionPoint(PlacesUtils.getConcreteItemId(this._resultNode),
                               eltIndex, Ci.nsITreeView.DROP_BEFORE);
          dropPoint.beforeIndex = eltIndex;
        }
        else if (this.isRTL ? (aEvent.clientX > eltRect.left + threshold)
                            : (aEvent.clientX < eltRect.right - threshold)) {
          // Drop inside this folder.
          dropPoint.ip =
            new InsertionPoint(PlacesUtils.getConcreteItemId(elt._placesNode),
                               -1, Ci.nsITreeView.DROP_ON,
                               PlacesUtils.nodeIsTagQuery(elt._placesNode));
          dropPoint.beforeIndex = eltIndex;
          dropPoint.folderElt = elt;
        }
        else {
          // Drop after this folder.
          let beforeIndex =
            (eltIndex == this._rootElt.childNodes.length - 1) ?
            -1 : eltIndex + 1;

          dropPoint.ip =
            new InsertionPoint(PlacesUtils.getConcreteItemId(this._resultNode),
                               beforeIndex, Ci.nsITreeView.DROP_BEFORE);
          dropPoint.beforeIndex = beforeIndex;
        }
      }
      else {
        // This is a non-folder node or a read-only folder.
        // Drop before it with regards to RTL mode.
        let threshold = eltRect.width * 0.5;
        if (this.isRTL ? (aEvent.clientX > eltRect.left + threshold)
                       : (aEvent.clientX < eltRect.left + threshold)) {
          // Drop before this bookmark.
          dropPoint.ip =
            new InsertionPoint(PlacesUtils.getConcreteItemId(this._resultNode),
                               eltIndex, Ci.nsITreeView.DROP_BEFORE);
          dropPoint.beforeIndex = eltIndex;
        }
        else {
          // Drop after this bookmark.
          let beforeIndex =
            eltIndex == this._rootElt.childNodes.length - 1 ?
            -1 : eltIndex + 1;
          dropPoint.ip =
            new InsertionPoint(PlacesUtils.getConcreteItemId(this._resultNode),
                               beforeIndex, Ci.nsITreeView.DROP_BEFORE);
          dropPoint.beforeIndex = beforeIndex;
        }
      }
    }
    else {
      // We are most likely dragging on the empty area of the
      // toolbar, we should drop after the last node.
      dropPoint.ip =
        new InsertionPoint(PlacesUtils.getConcreteItemId(this._resultNode),
                           -1, Ci.nsITreeView.DROP_BEFORE);
      dropPoint.beforeIndex = -1;
    }

    return dropPoint;
  },

  _setTimer: function PT_setTimer(aTime) {
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback(this, aTime, timer.TYPE_ONE_SHOT);
    return timer;
  },

  notify: function PT_notify(aTimer) {
    if (aTimer == this._updateChevronTimer) {
      this._updateChevronTimer = null;
      this._updateChevronTimerCallback();
    }

    // * Timer to turn off indicator bar.
    else if (aTimer == this._ibTimer) {
      this._dropIndicator.collapsed = true;
      this._ibTimer = null;
    }

    // * Timer to open a menubutton that's being dragged over.
    else if (aTimer == this._overFolder.openTimer) {
      // Set the autoopen attribute on the folder's menupopup so that
      // the menu will automatically close when the mouse drags off of it.
      this._overFolder.elt.lastChild.setAttribute("autoopened", "true");
      this._overFolder.elt.open = true;
      this._overFolder.openTimer = null;
    }

    // * Timer to close a menubutton that's been dragged off of.
    else if (aTimer == this._overFolder.closeTimer) {
      // Close the menubutton if we are not dragging over it or one of
      // its children.  The autoopened attribute will let the menu know to
      // close later if the menu is still being dragged over.
      let currentPlacesNode = PlacesControllerDragHelper.currentDropTarget;
      let inHierarchy = false;
      while (currentPlacesNode) {
        if (currentPlacesNode == this._rootElt) {
          inHierarchy = true;
          break;
        }
        currentPlacesNode = currentPlacesNode.parentNode;
      }
      // The _clearOverFolder() function will close the menu for
      // _overFolder.elt.  So null it out if we don't want to close it.
      if (inHierarchy)
        this._overFolder.elt = null;

      // Clear out the folder and all associated timers.
      this._clearOverFolder();
    }
  },

  _onMouseOver: function PT__onMouseOver(aEvent) {
    let button = aEvent.target;
    if (button.parentNode == this._rootElt && button._placesNode &&
        PlacesUtils.nodeIsURI(button._placesNode))
      window.XULBrowserWindow.setOverLink(aEvent.target._placesNode.uri, null);
  },

  _onMouseOut: function PT__onMouseOut(aEvent) {
    window.XULBrowserWindow.setOverLink("", null);
  },

  _cleanupDragDetails: function PT__cleanupDragDetails() {
    // Called on dragend and drop.
    PlacesControllerDragHelper.currentDropTarget = null;
    this._draggedElt = null;
    if (this._ibTimer)
      this._ibTimer.cancel();

    this._dropIndicator.collapsed = true;
  },

  _onDragStart: function PT__onDragStart(aEvent) {
    // Sub menus have their own d&d handlers.
    let draggedElt = aEvent.target;
    if (draggedElt.parentNode != this._rootElt || !draggedElt._placesNode)
      return;

    if (draggedElt.localName == "toolbarbutton" &&
        draggedElt.getAttribute("type") == "menu") {
      // If the drag gesture on a container is toward down we open instead
      // of dragging.
      let translateY = this._cachedMouseMoveEvent.clientY - aEvent.clientY;
      let translateX = this._cachedMouseMoveEvent.clientX - aEvent.clientX;
      if ((translateY) >= Math.abs(translateX/2)) {
        // Don't start the drag.
        aEvent.preventDefault();
        // Open the menu.
        draggedElt.open = true;
        return;
      }

      // If the menu is open, close it.
      if (draggedElt.open) {
        draggedElt.lastChild.hidePopup();
        draggedElt.open = false;
      }
    }

    // Activate the view and cache the dragged element.
    this._draggedElt = draggedElt._placesNode;
    this._rootElt.focus();

    this._controller.setDataTransfer(aEvent);
    aEvent.stopPropagation();
  },

  _onDragOver: function PT__onDragOver(aEvent) {
    // Cache the dataTransfer
    PlacesControllerDragHelper.currentDropTarget = aEvent.target;
    let dt = aEvent.dataTransfer;

    let dropPoint = this._getDropPoint(aEvent);
    if (!dropPoint || !dropPoint.ip ||
        !PlacesControllerDragHelper.canDrop(dropPoint.ip, dt)) {
      this._dropIndicator.collapsed = true;
      aEvent.stopPropagation();
      return;
    }

    if (this._ibTimer) {
      this._ibTimer.cancel();
      this._ibTimer = null;
    }

    if (dropPoint.folderElt || aEvent.originalTarget == this._chevron) {
      // Dropping over a menubutton or chevron button.
      // Set styles and timer to open relative menupopup.
      let overElt = dropPoint.folderElt || this._chevron;
      if (this._overFolder.elt != overElt) {
        this._clearOverFolder();
        this._overFolder.elt = overElt;
        this._overFolder.openTimer = this._setTimer(this._overFolder.hoverTime);
      }
      if (!this._overFolder.elt.hasAttribute("dragover"))
        this._overFolder.elt.setAttribute("dragover", "true");

      this._dropIndicator.collapsed = true;
    }
    else {
      // Dragging over a normal toolbarbutton,
      // show indicator bar and move it to the appropriate drop point.
      let ind = this._dropIndicator;
      let halfInd = ind.clientWidth / 2;
      let translateX;
      if (this.isRTL) {
        halfInd = Math.ceil(halfInd);
        translateX = 0 - this._rootElt.getBoundingClientRect().right - halfInd;
        if (this._rootElt.firstChild) {
          if (dropPoint.beforeIndex == -1)
            translateX += this._rootElt.lastChild.getBoundingClientRect().left;
          else {
            translateX += this._rootElt.childNodes[dropPoint.beforeIndex]
                              .getBoundingClientRect().right;
          }
        }
      }
      else {
        halfInd = Math.floor(halfInd);
        translateX = 0 - this._rootElt.getBoundingClientRect().left +
                     halfInd;
        if (this._rootElt.firstChild) {
          if (dropPoint.beforeIndex == -1)
            translateX += this._rootElt.lastChild.getBoundingClientRect().right;
          else {
            translateX += this._rootElt.childNodes[dropPoint.beforeIndex]
                              .getBoundingClientRect().left;
          }
        }
      }

      ind.style.transform = "translate(" + Math.round(translateX) + "px)";
      ind.style.MozMarginStart = (-ind.clientWidth) + "px";
      ind.collapsed = false;

      // Clear out old folder information.
      this._clearOverFolder();
    }

    aEvent.preventDefault();
    aEvent.stopPropagation();
  },

  _onDrop: function PT__onDrop(aEvent) {
    PlacesControllerDragHelper.currentDropTarget = aEvent.target;

    let dropPoint = this._getDropPoint(aEvent);
    if (dropPoint && dropPoint.ip) {
      PlacesControllerDragHelper.onDrop(dropPoint.ip, aEvent.dataTransfer)
      aEvent.preventDefault();
    }

    this._cleanupDragDetails();
    aEvent.stopPropagation();
  },

  _onDragExit: function PT__onDragExit(aEvent) {
    PlacesControllerDragHelper.currentDropTarget = null;

    // Set timer to turn off indicator bar (if we turn it off
    // here, dragenter might be called immediately after, creating
    // flicker).
    if (this._ibTimer)
      this._ibTimer.cancel();
    this._ibTimer = this._setTimer(10);

    // If we hovered over a folder, close it now.
    if (this._overFolder.elt)
        this._overFolder.closeTimer = this._setTimer(this._overFolder.hoverTime);
  },

  _onDragEnd: function PT_onDragEnd(aEvent) {
    this._cleanupDragDetails();
  },

  _onPopupShowing: function PT__onPopupShowing(aEvent) {
    if (!this._allowPopupShowing) {
      this._allowPopupShowing = true;
      aEvent.preventDefault();
      return;
    }

    let parent = aEvent.target.parentNode;
    if (parent.localName == "toolbarbutton")
      this._openedMenuButton = parent;

    PlacesViewBase.prototype._onPopupShowing.apply(this, arguments);
  },

  _onPopupHidden: function PT__onPopupHidden(aEvent) {
    let popup = aEvent.target;
    let placesNode = popup._placesNode;
    // Avoid handling popuphidden of inner views
    if (placesNode && PlacesUIUtils.getViewForNode(popup) == this) {
      // UI performance: folder queries are cheap, keep the resultnode open
      // so we don't rebuild its contents whenever the popup is reopened.
      // Though, we want to always close feed containers so their expiration
      // status will be checked at next opening.
      if (!PlacesUtils.nodeIsFolder(placesNode) ||
          this.controller.hasCachedLivemarkInfo(placesNode)) {
        placesNode.containerOpen = false;
      }
    }

    let parent = popup.parentNode;
    if (parent.localName == "toolbarbutton") {
      this._openedMenuButton = null;
      // Clear the dragover attribute if present, if we are dragging into a
      // folder in the hierachy of current opened popup we don't clear
      // this attribute on clearOverFolder.  See Notify for closeTimer.
      if (parent.hasAttribute("dragover"))
        parent.removeAttribute("dragover");
    }
  },

  _onMouseMove: function PT__onMouseMove(aEvent) {
    // Used in dragStart to prevent dragging folders when dragging down.
    this._cachedMouseMoveEvent = aEvent;

    if (this._openedMenuButton == null ||
        PlacesControllerDragHelper.getSession())
      return;

    let target = aEvent.originalTarget;
    if (this._openedMenuButton != target &&
        target.localName == "toolbarbutton" &&
        target.type == "menu") {
      this._openedMenuButton.open = false;
      target.open = true;
    }
  }
};

