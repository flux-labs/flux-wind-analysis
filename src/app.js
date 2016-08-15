'use strict';

function FluxApp (clientKey, redirectUri, projectMenu, isProd){
    this._fluxDataSelector = new FluxDataSelector(clientKey, redirectUri, {isProd:isProd});
    this._projectMenu = projectMenu;
    this._keysMenu = document.querySelector('#keysMenu');

    // Setup Flux Data Selector
    this._fluxDataSelector.setOnInitial(this.onInit.bind(this));
    this._fluxDataSelector.setOnLogin(this.onLogin.bind(this));
    this._fluxDataSelector.setOnProjects(this.populateProjects.bind(this));
    this._fluxDataSelector.setOnKeys(this.populateKeys.bind(this));
    this._fluxDataSelector.setOnValue(this.populateValue.bind(this));
    this._fluxDataSelector.init();
    this.canvas = document.querySelector('#imageCanvas');
    this.ctx = this.canvas.getContext('2d');
}
FluxApp.keyDescription = 'Image blob';

FluxApp.prototype.login = function () {
    this._fluxDataSelector.login();
}

FluxApp.prototype.onInit = function () {
}

FluxApp.prototype.onLogin = function () {
    this._fluxDataSelector.showProjects();

}

FluxApp.prototype.selectProject = function () {
    this._fluxDataSelector.selectProject(this._projectMenu.value);
    this._dt = this._fluxDataSelector.getDataTable(this._projectMenu.value).table;
}

FluxApp.prototype.selectKey = function () {
    this._fluxDataSelector.selectKey(this._keysMenu.value);
    // this._dt = this._fluxDataSelector.getDataTable(this._projectMenu.value).table;
}

FluxApp.prototype.createKey = function (name, data) {
    this._dt.createCell(name, {value:data, description:FluxApp.keyDescription}).then(function (cell) {
        console.log(cell);
    });
}

FluxApp.prototype.populateProjects = function (projectPromise) {
    var _this = this;
    projectPromise.then(function (projects) {
        for (var i=projects.entities.length-1;i>=0;i--) {
            var entity = projects.entities[i];
            var option = document.createElement('option');
            _this._projectMenu.appendChild(option);
            option.value = entity.id;
            option.textContent = entity.name;
        }
    });
}

FluxApp.prototype.populateKeys = function (keysPromise) {
    var _this = this;
    keysPromise.then(function (keys) {
        for (var i=0;i<keys.entities.length;i++) {
            var entity = keys.entities[i];
            var option = document.createElement('option');
            _this._keysMenu.appendChild(option);
            option.value = entity.id;
            option.textContent = entity.label;
            if (entity.label === 'Building Profiles') {
                _this._fluxDataSelector.selectKey(entity.id);
            }
        }
    });
}

FluxApp.prototype.populateValue = function (valuePromise) {
    var _this = this;
    valuePromise.then(function (entity) {
        if (typeof entity.value === 'string') {
            var dataUrl = entity.value;
            fetch(dataUrl).then(function(response) {
                return response.blob();
            }).then(function(blob) {
                _this.renderImageBlob(blob);
            });
        } else if (entity.value.constructor === Array) {
            // assume it's the footprints
            Site.processFootprints(entity.value);
        }
    });
}

FluxApp.prototype.logout = function () {
    this._fluxDataSelector.logout();
}

/**
 * Gets the flux token from it's place in cookies or localStorage.
 */
FluxApp.prototype.getFluxToken = function () {
    var fluxCredentials = JSON.parse(localStorage.getItem('fluxCredentials'));
    return fluxCredentials.fluxToken;
}

FluxApp.prototype.fileChanged = function (selector) {
    // file name map
    var files = selector.files;
    for (var i=0;i<files.length; i++) {
        var file = selector.files[i];
        this._readImageFile(file);
    }
};

FluxApp.prototype.renderImageBlob = function (blob) {
    var _this = this;
    createImageBitmap(blob).then(function (imageBitmap) {
        _this.canvas.width = imageBitmap.width;
        _this.canvas.height = imageBitmap.height;
        _this.ctx.drawImage(imageBitmap, 0, 0);
    });
};


FluxApp.prototype._readImageFile = function (imageFile) {
    var _this = this
    this.renderImageBlob(imageFile);
    var fileNameBase = FluxApp.stripExtension(imageFile.name);
    var reader = new FileReader();
    reader.onloadend = function (event) {
        var imgDataUrl = event.target.result;
        _this.createKey(fileNameBase, imgDataUrl);
    }
    reader.readAsDataURL(imageFile);
};

FluxApp.stripExtension = function (fileName) {
    var i = fileName.indexOf('.');
    if (i===-1) return fileName;
    return fileName.substring(0,i);
}
