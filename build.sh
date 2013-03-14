# zip must run from the directory that contains the files
# to give the right format for FF add-on.
cd MoreBookmarksToolbar
# -x to exclude (Mac)Vim swap files.
zip -r ../morebookmarkstoolbar.xpi * -x *.swp
cd ..
