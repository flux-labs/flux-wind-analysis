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


Site.prototype.getMesh = function (dataUrl, mesh) {
    if (!this.bounds) return;
    var scale = 1.0 / (this.uvScale);
    var offset = Site.paddingOffset;
    var minX = scale*(this.bounds[0][0]-offset);
    var minY = scale*(this.bounds[0][1]-offset);
    var maxX = minX+xdim*scale;
    var maxY = minY+ydim*scale;
    var props = {
        colorMap: dataUrl,
        noLighting: true
    }
    var dx = maxX - minX;
    var dy = maxY - minY;
    var uvs = [];
    for (var i=0;i<mesh.vertices.length;i++) {
        var v = mesh.vertices[i];
        var x = v[0];
        var y = v[1];
        var u = (x-minX) / dx;
        var v = (y-minY) / dy;
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

// Building Profiles
Site.prototype.processFootprints = function (values) {
    this.bounds = Site.findBounds(values);
    var bounds = this.bounds;
    var scale = Site.computeScales(bounds);
    this.uvScale = scale;
    // For each footprint
    for (var f=0;f<values.length;f++) {
        var footprint = values[f];
        if (footprint.primitive !== 'polyline') continue;
        var points = footprint.points;
        var len = points.length;
        for (var i=0;i<len;i++) {
            var point = points[i];
            var nextPoint = (i === len-1) ? points[0] : points[i+1];

            var x0 = point[0];
            var x1 = nextPoint[0];
            var y0 = point[1];
            var y1 = nextPoint[1];
            var lineLength = Site.calcLength(x0, y0, x1, y1);
            var dt = Math.max(1.0 / lineLength,0.01);
            for (var t=0;t<=1;t+=dt) {

                var xt = Site.lerp(x0, x1, t);
                var yt = Site.lerp(y0, y1, t);

                var x = Site.paddingOffset+Math.floor(scale*(xt)-bounds[0][0]);
                var y = Site.paddingOffset+Math.floor(scale*(yt)-bounds[0][1]);
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
    var scale = 1.0 / Math.max( Site.paddingScale * dx / xdim,
                                Site.paddingScale * dy / ydim);
    return scale;
};

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
