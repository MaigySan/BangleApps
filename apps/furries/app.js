// Pet Randomiser - Bangle.js 2



var Storage = require("Storage");

var pets = [
  {name:"Bits!",    file:"furries.bits.img"},
  {name:"Maigee!",  file:"furries.maigee.img"},
  {name:"Be-chan!", file:"furries.bechan.img"},
  {name:"Nero po!", file:"furries.neropo.img"}
];

var current = -1;

var palette = new Uint16Array([
  0x0000, // black
  0xFFFF  // white
]);

function showPet() {

  var n;

  // Pick a different pet
  do {
    n = (Math.random() * pets.length) | 0;
  } while (n === current);

  current = n;

  // White background
  g.setBgColor(1,1,1);
  g.clear();

  // Load image
  var raw = Storage.read(pets[n].file);

  if (raw) {

    var img = {
      width:120,
      height:114,
      bpp:1,
      buffer:E.toArrayBuffer(raw),
      palette:palette
    };

    g.drawImage(img,28,5);
  }

  // Name
  g.setColor(0,0,0);
  g.setFont("Vector",22);
  g.setFontAlign(0,0);

  g.drawString(pets[n].name,88,142);
}

Bangle.on("touch",showPet);

showPet();
