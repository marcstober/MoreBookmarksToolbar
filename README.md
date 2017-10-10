THIS ADD-ON IS NOT COMPATIBLE WITH FIREFOX 56 OR LATER. Due to changes in Firefox, unfortunately I'd need to do a completely rewrite of the Toolbar and it wouldn't even be able to work the way it did before, and I've changed my focus professionally so no longer have time to work on this. THANK YOU for your support and use of this tool over the years, I'm sorry to say goodbye! For more details see: <a href="http://www.marcstober.com/blog/2017/10/09/retiring-the-more-bookmarks-toolbar/">http://www.marcstober.com/blog/2017/10/09/retiring-the-more-bookmarks-toolbar/</a>

----

This is the source code for More Bookmarks Toolbar, 
a Firefox Extension by Marc Stober.

The actual source code of the extension is in the inner `morebookmarkstoolbar`
folder. A build script will zip the code into an XPI file structured 
for a Firefox Extension. Remember to `chmod +x build.sh` before running it.
(You could probably change the extension from `.sh` to 
`.bat` and run it on Windows, too, but I haven't tried that.)

The master file for the icon is in Pixelmator (Mac) format.

URL of relevant source code in Firefox 28: http://hg.mozilla.org/releases/mozilla-release/file/5f7c149b07ba/browser/components/places/content/browserPlacesViews.js
(A copy of this file is also in this repository.)
