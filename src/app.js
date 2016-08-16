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
    this.canvas = document.querySelector('#theCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.simulationKeyId = null;
    this.site = new Site();
    this._vpDiv = document.querySelector('#viewportContainer');
    this.keys = {};
}
FluxApp.keyDescription = 'Image blob';

// These keys are automatically fetched and made available as member variables
FluxApp.keys = {
    simulationKey: 'simulation',
    footprintKey: 'Building Profiles',
    topoKey: 'Topographic Mesh',
    buildingsRandomKey: 'Buildings (randomized height)',
    buildingsAccurateKey: 'Buildings (accurate height)'
};
FluxApp.keyArray = Object.keys(FluxApp.keys);
FluxApp.valueArray = FluxApp.keyArray.map(function (item) {return FluxApp.keys[item];});

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
    this.vp = new FluxViewport(this._vpDiv,{
        projectId: this._projectMenu.value,
        token: this.getFluxToken()
    });
    this.vp.setupDefaultLighting();
    this.vp.setupDefaultLighting();
    this.vp.homeCamera();
}

FluxApp.prototype.selectKey = function () {
    this._fluxDataSelector.selectKey(this._keysMenu.value);
}

FluxApp.prototype.createKey = function (name, data) {
    this._dt.createCell(name, {value:data, description:FluxApp.keyDescription}).then(function (cell) {
        console.log(cell);
    });
}

FluxApp.prototype.updateKey = function (id, data) {
    this._dt.updateCell(id, {value:data, description:FluxApp.keyDescription}).then(function (cell) {
        console.log(cell);
    });
};


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
            if (FluxApp.valueArray.indexOf(entity.label) !== -1) {
                _this._fluxDataSelector.selectKey(entity.id);
            }
            if (entity.label === FluxApp.keys.simulationKey) {
                _this.simulationKeyId = entity.id;
            }
        }
    });
}

FluxApp.prototype.populateValue = function (valuePromise) {
    var _this = this;
    valuePromise.then(function (entity) {
        var index = FluxApp.valueArray.indexOf(entity.label);
        if (index !== -1) {
            _this.keys[FluxApp.keyArray[index]] = entity.value;
        }
        if (entity.label === FluxApp.keys.footprintKey) {
            _this.site.processFootprints(entity.value);
        }
        if (index !== -1) { // TODO make sure it doesnt get called twice
            var geomKey = _this.keys.buildingsAccurateKey && _this.keys.buildingsAccurateKey.length > 0 ? _this.keys.buildingsAccurateKey : _this.keys.buildingsRandomKey;
            _this.vp.setGeometryEntity([_this.keys.footprintKey, _this.keys.simulationKey, geomKey]);
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

FluxApp.prototype.uploadImage = function () {
    var dataUrl = this.canvas.toDataURL();
    // this.createKey('simulation', dataUrl);
    if (this.simulationKeyId == null) {
        this.createKey(FluxApp.simulationKey, this.site.getMesh(dataUrl, this.keys.topoKey));
    } else {
        this.updateKey(this.simulationKeyId, this.site.getMesh(dataUrl, this.keys.topoKey));
    }

};


FluxApp.stripExtension = function (fileName) {
    var i = fileName.indexOf('.');
    if (i===-1) return fileName;
    return fileName.substring(0,i);
}
