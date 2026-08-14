'use strict';
window.HDV3=window.HDV3||{};
window.HDV3.build='V3.3.4 RIGID GUIDE FRAME';
window.HDV3.goldenBase='V1.9f2';
window.HDV3.architecture={
  modes:{build:{status:'active'},accessories:{status:'reserved'},photo:{status:'reserved'}},
  tools:{ring:{status:'active'},connect:{status:'active'},panel:{status:'active'},strapPaint:{status:'reserved'}},
  futureServices:{
    BodyProvider:'reserved for Body Lab',
    AccessoryRegistry:'reserved',
    PhotoController:'reserved',
    PoseController:'reserved',
    MaterialRegistry:'reserved',
    AnchorService:'legacy-to-extract',
    CrossingService:'legacy-to-extract',
    ExportService:'reserved',
    GeneratorRegistry:'reserved'
  },
  modules:{}
};
window.HDV3.registerModule=function(id,meta){this.architecture.modules[id]=Object.assign({},meta)};
