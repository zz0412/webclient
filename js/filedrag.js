(function(scope) {

    var dir_inflight = 0;
    var filedrag_u = [];
    var filedrag_paths = Object.create(null);
    var touchedElement = 0;

    function addUpload(files, emptyFolders) {
        console.assert(page === 'start' || window.fminitialized, 'check this...');

        if (page === 'start' || M.chat) {
            M.addUpload(files, false, emptyFolders);
        }
        else {
            openCopyUploadDialog(files, emptyFolders);
        }
    }

    function pushUpload() {
        if (!--dir_inflight && $.dostart) {
            var emptyFolders = Object.keys(filedrag_paths)
                .filter(function(p) {
                    return filedrag_paths[p] < 1;
                });

            addUpload(filedrag_u, emptyFolders);
            filedrag_u = [];
            filedrag_paths = Object.create(null);

            if (page === 'start') {
                start_upload();
            }
        }
    }

    function pushFile(file, path) {
        if (d > 1) {
            console.warn('Adding file %s', file.name, file);
        }
        if (file) {
            file.path = path;
            filedrag_u.push(file);
        }
        pushUpload();
    }

    function getFile(entry) {
        return new Promise(function(resolve, reject) {
            entry.file(resolve, reject);
        });
    }

    function traverseFileTree(item, path, symlink) {
        path = path || "";

        if (item.isFile) {
            dir_inflight++;
            getFile(item).then(function(file) {
                pushFile(file, path);
            }).catch(function(error) {
                if (d) {
                    var fn = symlink ? 'debug' : 'warn';

                    console[fn]('Failed to get File from FileEntry for "%s", %s',
                        item.name, Object(error).name, error, item);
                }
                pushFile(symlink, path);
            });
        }
        else if (item.isDirectory) {
            var newPath = path + item.name + "/";
            filedrag_paths[newPath] = 0;
            dir_inflight++;
            var dirReader = item.createReader();
            var dirReaderIterator = function() {
                dirReader.readEntries(function(entries) {
                    if (entries.length) {
                        var i = entries.length;
                        while (i--) {
                            traverseFileTree(entries[i], newPath);
                        }
                        filedrag_paths[newPath] += entries.length;

                        dirReaderIterator();
                    }
                    else {
                        pushUpload();
                    }
                }, function(error) {
                    console.warn('Unable to traverse folder "%s", %s',
                        item.name, Object(error).name, error, item);

                    pushUpload();
                });
            };
            dirReaderIterator();
        }
        if (d && dir_inflight == 0) {
            console.log('end');
        }
    }

    function start_upload() {
        if (u_wasloggedin()) {
            msgDialog('confirmation', l[1193], l[2001], l[2002], function(e) {
                if (e) {
                    start_anoupload();
                }
                else {
                    tooltiplogin.init();
                    $.awaitingLoginToUpload = true;

                    mBroadcaster.once('fm:initialized', function() {
                        ulQueue.resume();
                        uldl_hold = false;

                        if (ul_queue.length > 0) {
                            M.showTransferToast('u', ul_queue.length);
                        }
                    });
                }
            });
        }
        else {
            start_anoupload();
        }
    }

    function start_anoupload() {
        u_storage = init_storage(localStorage);
        loadingDialog.show();
        u_checklogin({
            checkloginresult: function(u_ctx, r) {
                u_type = r;
                u_checked = true;
                loadingDialog.hide();
                loadSubPage('fm');
            }
        }, true);
    }

    function FileDragEnter(e) {
        if (d) {
            console.log('DragEnter');
        }
        if ($.dialog === 'avatar') {
            return;
        }
        e.stopPropagation();
        e.preventDefault();
        if (localStorage.d > 1) {
            console.info('----- ENTER event :' + e.target.className);
        }
        touchedElement++;
        if (touchedElement === 1) {
            $('.drag-n-drop.overlay').removeClass('hidden');
            $('body').addClass('overlayed');
        }

    }

    function FileDragHover(e) {
        if (d) {
            console.log('DragOver');
        }
        e.stopPropagation();
        e.preventDefault();
    }
    var useMegaSync = -1;
    var usageMegaSync = 0;


    function FileSelectHandlerMegaSyncClick(e) {
        if (page.indexOf('/chat/') > -1) {
            return true;
        }
        if (useMegaSync === -1) {
            e.preventDefault();
            e.stopPropagation();
            megasync.isInstalled(function (err, is) {
                if (!err || is) {
                    if (megasync.currUser === u_handle) {
                        useMegaSync = 2;
                    }
                    else {
                        useMegaSync = 3;
                    }
                }
                else {
                    useMegaSync = 3;
                }
            });
            return false;
        }
        else if (useMegaSync === 3) {
            useMegaSync = -1
            return true;
        }
        else if (useMegaSync === 2) {
            e.preventDefault();
            e.stopPropagation();
            var target;
            if ($.onDroppedTreeFolder) {
                target = $.onDroppedTreeFolder;
                delete $.onDroppedTreeFolder;
            }
            else if (String(M.currentdirid).length !== 8) {
                target = M.lastSeenCloudFolder || M.RootID;
            }
            else {
                target = M.currentdirid;
            }

            var uploadCmdIsFine = function _uploadCmdIsFine(error, response) {
                if (error) {
                    useMegaSync = 3;
                }
            };

            //var elem = $('#' + e.toElement.id)[0];
            var elem = e.target;
            if (elem.hasAttribute('webkitdirectory') || elem.hasAttribute('mozdirectory')
                || elem.hasAttribute('msdirectory') || elem.hasAttribute('odirectory')
                || elem.hasAttribute('directory')) {
                megasync.uploadFolder(target, uploadCmdIsFine);
            }
            else {
                megasync.uploadFile(target, uploadCmdIsFine);
            }
            return false;
        }
        else {
            if (localStorage.dd && localStorage.jj && localStorage.d) {
                console.warn('Strange value of UseMegaSync found = ' + useMegaSync);
            }
            return true;
        }
    }
    function FileSelectHandlerMegaSyncMouse(e) {
        e.preventDefault();
        e.stopPropagation();
        if (useMegaSync === -1) {
            megasync.isInstalled(function (err, is) {
                if (!err || is) {
                    if (megasync.currUser === u_handle) {
                        useMegaSync = 2;
                    }
                    else {
                        useMegaSync = 3;
                    }
                }
                else {
                    useMegaSync = 3;
                }
            });
            return false;
        }
        else if (useMegaSync === 2 && ++usageMegaSync > 3) {
            useMegaSync = -1;
            usageMegaSync = 0;
            return false;
        }
        else {
            return false;
        }
    }
    function FileDragLeave(e) {
        if (d) {
            console.log('DragLeave');
        }
        if ($.dialog === 'avatar') {
            return;
        }
        e.stopPropagation();
        e.preventDefault();
        if (localStorage.d > 1) {
            console.warn('----- LEAVE event :' + e.target.className + '   ' + e.type);
        }
        touchedElement--;
        // below condition is due to firefox bug. https://developer.mozilla.org/en-US/docs/Web/Events/dragenter
        if ((touchedElement <= 0) || (touchedElement === 1 && ua.details.browser === 'Firefox')) {
            $('.drag-n-drop.overlay').addClass('hidden');
            $('body').removeClass('overlayed');
            touchedElement = 0;
        }
    }

    // on Drop event
    function FileSelectHandler(e) {
        if ($.dialog === 'avatar') {
            return;
        }
        useMegaSync = -1;
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        if (e.preventDefault) {
            e.preventDefault();
        }

        var currentDir = M.currentdirid;

        // Clear drag element
        touchedElement = 0;

        $('.drag-n-drop.overlay').addClass('hidden');
        $('body').removeClass('overlayed');

        if ($.awaitingLoginToUpload) {
            return tooltiplogin.init();
        }

        if (
            (
                folderlink ||
                currentDir === 'contacts' ||
                (
                    currentDir !== 'dashboard' &&
                    currentDir !== 'transfers' &&
                    (M.getNodeRights(currentDir) | 0) < 1
                )
            ) &&
            String(currentDir).indexOf("chat/") === -1
        ) {
            msgDialog('warningb', l[1676], l[1023]);
            return true;
        }

        if (page == 'start') {
            if ($('#fmholder').html() == '') {
                $('#fmholder').html(translate(pages['fm'].replace(/{staticpath}/g, staticpath)));
            }
        }

        var dataTransfer = Object(e.dataTransfer);
        var files = e.target.files || dataTransfer.files;
        if (!files || files.length == 0) {
            if (!is_chrome_firefox || !dataTransfer.mozItemCount) {
                return false;
            }
        }

        if (localStorage.testMediaInfo) {
            return MediaInfoLib.test(files);
        }
        if (localStorage.testGetID3CoverArt) {
            return getID3CoverArt(files[0]).then(function(ab) {
                console.info('getID3CovertArt result', mObjectURL([ab], 'image/jpeg'));
            }).catch(console.debug.bind(console));
        }
        if (localStorage.testStreamerThumbnail) {
            return M.require('videostream').tryCatch(function() {
                Streamer.getThumbnail(files[0])
                    .then(function(ab) {
                        console.info('Streamer.getThumbnail result', mObjectURL([ab], 'image/jpeg'));
                    })
                    .catch(console.debug.bind(console));
            });
        }

        if (e.dataTransfer
                && e.dataTransfer.items
                && e.dataTransfer.items.length > 0 && e.dataTransfer.items[0].webkitGetAsEntry) {
            var items = e.dataTransfer.items;
            for (var i = 0; i < items.length; i++) {
                if (items[i].webkitGetAsEntry) {
                    var item = items[i].webkitGetAsEntry();
                    if (item) {
                        filedrag_u = [];
                        if (i == items.length - 1) {
                            $.dostart = true;
                        }
                        traverseFileTree(item, '', item.isFile && items[i].getAsFile());
                    }
                }
            }
        }
        else if (is_chrome_firefox && e.dataTransfer) {
            try {
                for (var i = 0, m = e.dataTransfer.mozItemCount; i < m; ++i) {
                    var file = e.dataTransfer.mozGetDataAt("application/x-moz-file", i);
                    if (file instanceof Ci.nsIFile) {
                        filedrag_u = [];
                        if (i == m - 1) {
                            $.dostart = true;
                        }
                        traverseFileTree(new mozDirtyGetAsEntry(file /*,e.dataTransfer*/ ));
                    }
                    else {
                        if (d) {
                            console.log('FileSelectHandler: Not a nsIFile', file);
                        }
                    }
                    // e.dataTransfer.mozClearDataAt("application/x-moz-file", i);
                }
            }
            catch (e) {
                alert(e);
                Cu.reportError(e);
            }
        }
        else {
            var u = [];
            var gecko = dataTransfer && ("mozItemCount" in dataTransfer) || Object(ua.details).browser === 'Firefox';
            if (gecko && parseFloat(Object(ua.details).version) > 51) {
                // No need to check for folder upload attempts through zero-bytes on latest Firefox versions
                gecko = false;
            }
            for (var i = 0, f; f = files[i]; i++) {
                if (f.webkitRelativePath) {
                    f.path = String(f.webkitRelativePath).replace(RegExp("[\\/]"
                            + String(f.name).replace(/([^\w])/g,'\\$1') + "$"), '');
                }
                if (gecko) {
                    f.gecko = true;
                }
                if (f.name != '.') {
                    u.push(f);
                    if (Math.floor(f.lastModified / 1000) === Math.floor(Date.now() / 1000)) {
                        api_req({a: 'log', e: 99659, m: 'file modification time uses current time for uploading.'});
                    }
                }
            }
            addUpload(u);
            if (page == 'start') {
                start_upload();
            }
            $('.fm-file-upload input').remove();
            $('.fm-file-upload').append('<input type="file" id="fileselect1" title="' + l[99] + '" multiple="">');
            $('.fm-folder-upload input').remove();
            $('.fm-folder-upload').append('<input type="file" id="fileselect2" webkitdirectory="" title="' +
                l[98]
                + '" multiple="">');
            $('input#fileselect3').remove();
            $('.files-menu .fileupload-item')
                .after('<input type="file" id="fileselect3" class="hidden" name="fileselect3" multiple="">');
            $('input#fileselect4').remove();
            $('.files-menu .folderupload-item').after('<input type="file" id="fileselect4"' +
                ' name="fileselect4" webkitdirectory="" multiple="" class="hidden">');
            InitFileDrag();
        }
        return true;
    }

    function onDragStartHandler(e) {
        if ((e.target && e.target.toString && e.target.toString() === '[object Text]')
            || page.indexOf('/fm/') === -1) {
            e.stopPropagation();
            e.preventDefault();
            return false;
        }
    }

    // initialize TODO 添加上传按钮监听
    scope.InitFileDrag = function() {
        var i = 5;
        while (i--) {
            var o = document.getElementById(i ? 'fileselect' + i : 'start-upload');
            if (o) {
                o.addEventListener("change", FileSelectHandler, false);
                if (!is_mobile && i) {
                    o.addEventListener("click", FileSelectHandlerMegaSyncClick, true);
                    o.addEventListener("mouseover", FileSelectHandlerMegaSyncMouse, true);
                }
            }
        }

        var fnHandler = FileSelectHandler;
        var fnEnter = FileDragEnter;
        var fnHover = FileDragHover;
        var fnLeave = FileDragLeave;

        touchedElement = 0;

        // MEGAdrop upload
        var elem = document.getElementById("wu_items");
        if (elem) {
            fnHandler = mega.megadrop.upload;
            document.getElementById("fileselect5").addEventListener("change", fnHandler, false);
        }

        document.getElementsByTagName("body")[0].addEventListener("dragenter", fnEnter, false);
        document.getElementsByTagName("body")[0].addEventListener("dragover", fnHover, false);
        document.getElementsByTagName("body")[0].addEventListener("dragleave", fnLeave, false);
        document.getElementsByTagName("body")[0].addEventListener("drop", fnHandler, false);
        document.getElementsByTagName("body")[0].addEventListener("dragstart", onDragStartHandler, false);


        if (is_chrome_firefox) {
            $('input[webkitdirectory], .fm-folder-upload input').click(function(e) {
                var file = mozFilePicker(0, 2, { /*gfp:1,*/
                    title: l[98]
                });

                if (file) {
                    e.target = {
                        files: [-1]
                    };
                    e.dataTransfer = {
                        mozItemCount: 1,
                        mozGetDataAt: function() {
                            return file;
                        }
                    };
                    FileSelectHandler(e);
                    file = undefined;
                }
                else {
                    if (e.stopPropagation) {
                        e.stopPropagation();
                    }
                    if (e.preventDefault) {
                        e.preventDefault();
                    }
                }
            });
        }
    }

})(this);

// Selenium helper to fake a drop event
function fakeDropEvent(target) {
    // hash: "MTIzNAAAAAAAAAAAAAAAAAOLqRY"
    var file = new File(['1234'], 'test\u202Efdp.exe', {
        type: "application/octet-stream",
        lastModified: 1485195382
    });

    var ev = document.createEvent("HTMLEvents");
    ev.initEvent("drop", true, true);
    ev.dataTransfer = {
        files: [file]
    };

    target = target || document.getElementById("startholder");
    target.dispatchEvent(ev);
}
