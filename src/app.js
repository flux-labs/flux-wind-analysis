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
    this.simulationImageKeyId = null;
    this.simulationMeshKeyId = null;
    this.simulationVectorsKeyId = null;
    this.site = new Site();
    this._vpDiv = document.querySelector('#viewportContainer');
    this.keys = {};
    this.keyCount=0;
}
FluxApp.imageKeyDescription = 'Image blob';
FluxApp.defaultDescription = 'Created by Flux Wind Analysis';

// These keys are automatically fetched and made available as member variables
FluxApp.keys = {
    simulationImageKey: 'Simulation Image',
    simulationMeshKey: 'Simulation Mesh',
    simulationVectorsKey: 'Simulation Vectors',
    footprintKey: 'Building Footprints',
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
FluxApp.prototype.setKey = function (id, label, data) {
    var _this = this;
    this._dt.fetchCell(id).then(function (entity) {
        if (entity.id == null) {
            _this.createKey(label, data);
        } else {
            _this.updateKey(id, data);
        }
    });
};

FluxApp.prototype.createKey = function (name, data, description) {
    this.keyCount+=1;
    console.log('createKey', name);
    var descr = description ? description : FluxApp.defaultDescription;
    var _this = this;
    return this._dt.createCell(name, {value:data, description:descr}).then(function (cell) {

        if (name === FluxApp.keys.simulationMeshKey) {
            _this.simulationMeshKeyId = cell.id;
        }
        if (name === FluxApp.keys.simulationVectorsKey) {
            _this.simulationVectorsKeyId = cell.id;
        }
        if (name === FluxApp.keys.simulationImageKey) {
            _this.simulationImageKeyId = cell.id;
        }
        // Select the key so we can see it's new value
        return _this._fluxDataSelector.selectKey(cell.id);
    });
}

FluxApp.prototype.updateKey = function (id, data, description) {
    this.keyCount+=2;// The data table sends two responses per key
    console.log('updateKey', id);
    var descr = description ? description : FluxApp.defaultDescription;
    return this._dt.updateCell(id, {value:data, description:descr});
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
            if (entity.label === FluxApp.keys.simulationMeshKey) {
                _this.simulationMeshKeyId = entity.id;
            }
            if (entity.label === FluxApp.keys.simulationVectorsKey) {
                _this.simulationVectorsKeyId = entity.id;
            }
            if (entity.label === FluxApp.keys.simulationImageKey) {
                _this.simulationImageKeyId = entity.id;
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
            _this.keyCount--;
        }
        if (entity.label === FluxApp.keys.footprintKey) {
            _this.site.processFootprints(entity.value);
        }
        //TODO this could work better
        if (_this.keyCount===0) {
            console.log("ALL DONE update viewport.");
            _this.updateViewport();
        }
    });
}

FluxApp.prototype.updateViewport = function () {
    var geomKey = this.keys.buildingsAccurateKey && this.keys.buildingsAccurateKey.length > 0 ? this.keys.buildingsAccurateKey : this.keys.buildingsRandomKey;
    this.vp.setGeometryEntity([this.keys.footprintKey, this.keys.simulationMeshKey, this.keys.simulationVectorsKey, geomKey]);
};

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
    this.keyCount = 0;
    var dataUrl = this.canvas.toDataURL();

    this.setKey(this.simulationImageKeyId, FluxApp.keys.simulationImageKey, dataUrl);

    var geomData = this.site.getMesh(dataUrl, this.keys.topoKey);
    var promiseGeom = this.setKey(this.simulationMeshKeyId, FluxApp.keys.simulationMeshKey, geomData);

    var vectorsData = this.site.getVectors();
    var promiseVectors = this.setKey(this.simulationVectorsKeyId, FluxApp.keys.simulationVectorsKey, vectorsData);

    var _this = this;
    Promise.all([promiseGeom, promiseVectors]).then(function () {
        console.log('update');
        _this.updateViewport();
    });
};


FluxApp.stripExtension = function (fileName) {
    var i = fileName.indexOf('.');
    if (i===-1) return fileName;
    return fileName.substring(0,i);
}
