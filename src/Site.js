'use-strict';

function Site() {
    this.bounds = null;
    this.uvScale = 0;
}
Site.paddingScale = 1.2;
Site.paddingOffset = 15;

Site.lerp = function(x, y, t) {
    return x + (y - x) * t;
};

Site.calcLength = function(x0, y0, x1, y1) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    return Math.sqrt(dx*dx+dy*dy);
};

/**
 * Determine if the x, y pair is in the bounding box of the footprints in world space
 * @param  {Number} x World space query x
 * @param  {Number} y World space query y
 * @return {Boolean}   True if it's inside
 */
Site.prototype.inBounds = function (x, y) {
    return x > this.bounds[0][0] && x < this.bounds[1][0] && y > this.bounds[0][1] && y < this.bounds[1][1];
}

/**
 * Get the velocity vectors flow lines.
 * @return {Array.<Object>} Array of lines as Flux JSON
 */
Site.prototype.getVectors = function () {
    var paddedBounds = this.getPaddedBounds();
    var minX = paddedBounds[0][0];
    var minY = paddedBounds[0][1];
    var maxX = paddedBounds[1][0];
    var maxY = paddedBounds[1][1];
    var dx = maxX - minX;
    var dy = maxY - minY;

    var verts = [];
    var xInc = 4;
    var yInc = 4;
    var sitesPerFlowline = 1;
    var scaleFactor = 50 * (xInc/6.0) * pxPerSquare;
    for (var yCount=0; yCount<ydim; yCount+=yInc) {
        var y = Math.round((yCount+0.5) * sitesPerFlowline);
        for (var xCount=0; xCount<xdim; xCount+=xInc) {
            var x = Math.round((xCount+0.5) * sitesPerFlowline);
            var thisUx = ux[x+y*xdim];
            var thisUy = uy[x+y*xdim];
            var speed = Math.sqrt(thisUx*thisUx + thisUy*thisUy);
            var wx = this.simToWorldSpaceX(x);
            var wy = this.simToWorldSpaceY(y);
            // Export nonzero values that are in the region of the buildings
            if (speed > 0.0001 && this.inBounds(wx,wy)) {
                var scale = scaleFactor * Math.pow(speed,0.5);
                verts.push([[wx-thisUx*scale, wy-thisUy*scale],
                            [wx+thisUx*scale, wy+thisUy*scale]])
            }
        }
    }

    var lines = [];
    for (var i=0;i<verts.length; i++) {
        var vert = verts[i];
        var line = {
            "start": [vert[0][0],vert[0][1],this.maxZ+1],
            "end":   [vert[1][0],vert[1][1],this.maxZ+1],
            "primitive":"line"
        };
        lines.push(line);
    }
    return lines;
    return null;
}

Site.prototype.getPaddedBounds = function() {
    if (this.bounds == null || this.uvScale == null) {
        console.warn('Cant call get mesh before bounds and scale are set');
        return;
    }
    var minX = this.simToWorldSpaceX(0);
    var minY = this.simToWorldSpaceY(0);
    var maxX = this.simToWorldSpaceX(xdim);
    var maxY = this.simToWorldSpaceY(ydim);
    return [[minX, minY],[maxX, maxY]];
}
/**
 * Get a copy of the Topographic Mesh key, but with texture and uvs from simulation.
 * @param  {String} dataUrl Blob url containing image data of texture
 * @param  {Object} mesh    Source mesh (Flux JSON)
 * @return {Object}         New mesh (Flux JSON)
 */
Site.prototype.getMesh = function (dataUrl, mesh) {
    var paddedBounds = this.getPaddedBounds();
    var minX = paddedBounds[0][0];
    var minY = paddedBounds[0][1];
    var maxX = paddedBounds[1][0];
    var maxY = paddedBounds[1][1];
    var dx = maxX - minX;
    var dy = maxY - minY;

    var props = {
        colorMap: dataUrl,
        noLighting: true
    }
    var uvs = [];

    for (var i=0;i<mesh.vertices.length;i++) {
        var vert = mesh.vertices[i];
        var wx = vert[0];
        var wy = vert[1];
        var u = (wx-minX) / dx;
        var v = (wy-minY) / dy;
        uvs.push([u,v]);
    }
    return {
        "attributes":{
            "materialProperties":props,
            "uvs":uvs
        },
        "vertices": mesh.vertices,
        "faces": mesh.faces,
        "primitive":"mesh"
    };
}

Site.prototype.simToWorldSpaceX = function(sx) {
    return ((sx-Site.paddingOffset) / this.uvScale) + this.bounds[0][0];
}

Site.prototype.simToWorldSpaceY = function(sy) {
    return ((sy-Site.paddingOffset) / this.uvScale) + this.bounds[0][1];
}

Site.prototype.worldToSimSpaceX = function(wx) {
    return Site.paddingOffset+Math.floor(this.uvScale*(wx-this.bounds[0][0]));
}

Site.prototype.worldToSimSpaceY = function (wy) {
    return Site.paddingOffset+Math.floor(this.uvScale*(wy-this.bounds[0][1]));
}

// Building Profiles
Site.prototype.processFootprints = function (values) {
    this.bounds = Site.findBounds(values);
    var bounds = this.bounds;
    var scale = Site.computeScales(bounds);
    this.uvScale = scale;
    this.maxZ = -Infinity;
    // For each footprint
    for (var f=0;f<values.length;f++) {
        var footprint = values[f];
        if (footprint.primitive !== 'polyline') continue;
        var points = footprint.points;
        var len = points.length;
        // for each point on the line
        for (var i=0;i<len;i++) {
            var point = points[i];
            var nextPoint = (i === len-1) ? points[0] : points[i+1];

            if (point[2] > this.maxZ) {
                this.maxZ = point[2];
            }
            var x0 = point[0];
            var x1 = nextPoint[0];
            var y0 = point[1];
            var y1 = nextPoint[1];
            var lineLength = Site.calcLength(x0, y0, x1, y1);
            var dt = Math.max(1.0 / lineLength,0.01);
            for (var t=0;t<=1;t+=dt) {

                var xt = Site.lerp(x0, x1, t);
                var yt = Site.lerp(y0, y1, t);

                // var x = Site.paddingOffset+Math.floor(scale*(xt-bounds[0][0]));
                // var y = Site.paddingOffset+Math.floor(scale*(yt-bounds[0][1]));
                var x = this.worldToSimSpaceX(xt);
                var y = this.worldToSimSpaceY(yt);
                barrier[x+y*xdim] = true;
            }
        }
    }

    // Call the render function for the fluid solver
    paintCanvas();
};

Site.computeScales = function (bounds) {
    var minP = bounds[0];
    var maxP = bounds[1];
    var dx = maxP[0]-minP[0]+Site.paddingOffset;
    var dy = maxP[1]-minP[1]+Site.paddingOffset;
    var scaleX = xdim / (Site.paddingScale * dx);
    var scaleY = ydim / (Site.paddingScale * dy);
    var scale = Math.min( scaleX, scaleY);
    return scale;
};

/**
 * Find the bounds of the polyline in world space (ws)
 * @param  {Array.<Object>} values Array of polyline flux JSON
 * @return {Array.Array.<Number>}        [[minx, miny],[maxx,maxy]]
 */
Site.findBounds = function (values) {
    var minP = [Infinity, Infinity];
    var maxP = [-Infinity, -Infinity];
    for (var f=0;f<values.length;f++) {
        var footprint = values[f];
        if (footprint.primitive !== 'polyline') continue;
        var points = footprint.points;
        var len = points.length;
        for (var i=0;i<len;i++) {
            var point = points[i];

            var x0 = point[0];
            var y0 = point[1];
            if (x0 > maxP[0]) {
                maxP[0] = x0;
            }
            if (y0 > maxP[1]) {
                maxP[1] = y0;
            }
            if (x0 < minP[0]) {
                minP[0] = x0;
            }
            if (y0 < minP[1]) {
                minP[1] = y0;
            }
        }
    }
    return [minP, maxP]
};
