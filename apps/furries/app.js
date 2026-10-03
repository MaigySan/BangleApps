// Pet Randomiser - Bangle.js 2
// Requires bits.img, maigee.img, bechan.img and neropo.img in Storage.

var Storage = require("Storage");
var pets = [
  {name:"Bits!", file:"bits.img"},
  {name:"Maigee!", file:"maigee.img"},
  {name:"Be-chan!", file:"bechan.img"},
  {name:"Nero po!", file:"neropo.img"}
];
var current = -1;
var palette = new Uint16Array([0x0000,0xFFFF]); // black, white

function showPet() {
  var n;
  do { n = (Math.random()*pets.length)|0; } while (n===current);
  current=n;

  g.setBgColor(1,1,1);
  g.clear();

  var raw=Storage.read(pets[n].file);
  if (raw) {
    var img={
      width:120, height:114, bpp:1,
      buffer:E.toArrayBuffer(raw),
      palette:palette
    };
    g.drawImage(img,28,5);
  }

  g.setColor(0,0,0);
  g.setFont("Vector",22);
  g.setFontAlign(0,0);
  g.drawString(pets[n].name,88,142);
}

Bangle.on("touch",showPet);
showPet();
