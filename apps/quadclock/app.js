// Four Squares - a full-screen Bangle.js 2 clock.
(function () {
  var locale = require("locale");
  var is12Hour = !!(require("Storage").readJSON("setting.json", 1) || {})["12hour"];
  var width = g.getWidth();
  var height = g.getHeight();
  var halfWidth = Math.floor(width / 2);
  var halfHeight = Math.floor(height / 2);
  var tiles = [
    { x: 0, y: 0, w: halfWidth, h: halfHeight },
    { x: halfWidth, y: 0, w: width - halfWidth, h: halfHeight },
    { x: 0, y: halfHeight, w: halfWidth, h: height - halfHeight },
    { x: halfWidth, y: halfHeight, w: width - halfWidth, h: height - halfHeight }
  ];
  var previous = [];
  var minuteTimer;
  var stepTimer;

  function pad2(value) {
    return (value < 10 ? "0" : "") + value;
  }

  function text(value, tile, offset, size) {
    var center = tile.x + Math.floor(tile.w / 2);
    g.setFontAlign(0, 0);
    if (size) {
      // Keep long step counts and translated dates inside their own tile.
      g.setFont("Vector", size);
      while (g.stringWidth(value) > tile.w - 12 && size > 8) {
        g.setFont("Vector", --size);
      }
    } else {
      g.setFont("6x8");
      if (g.stringWidth(value) > tile.w - 12) {
        return text(value, tile, offset, 12);
      }
    }
    g.drawString(value, center, tile.y + Math.round(tile.h * offset));
  }

  function beginTile(index, label) {
    var tile = tiles[index];
    g.reset().setColor("#000").fillRect(tile.x, tile.y,
      tile.x + tile.w - 1, tile.y + tile.h - 1);
    // Dividers belong to the left/top tiles, so partial redraws preserve them.
    g.setColor("#fff");
    if (index % 2 === 0) {
      g.drawLine(tile.x + tile.w - 1, tile.y,
        tile.x + tile.w - 1, tile.y + tile.h - 1);
    }
    if (index < 2) {
      g.drawLine(tile.x, tile.y + tile.h - 1,
        tile.x + tile.w - 1, tile.y + tile.h - 1);
    }
    g.setColor("#0ff");
    text(label, tile, 0.14);
    g.setColor("#fff");
    return tile;
  }

  function drawTime(date) {
    var hours = date.getHours();
    var value = pad2(is12Hour ? (hours % 12 || 12) : hours) + ":" + pad2(date.getMinutes());
    var footer = is12Hour ? (hours < 12 ? "AM" : "PM") : "24H";
    var key = value + footer;
    if (previous[0] === key) return;
    previous[0] = key;
    var tile = beginTile(0, "TIME");
    text(value, tile, 0.48, 32);
    text(footer, tile, 0.81);
  }

  function drawDate(date) {
    var weekday = locale.dow(date, 1).toUpperCase();
    var footer = locale.month(date, 1).toUpperCase() + " " + date.getFullYear();
    var key = weekday + date.getDate() + footer;
    if (previous[1] === key) return;
    previous[1] = key;
    var tile = beginTile(1, weekday);
    text("" + date.getDate(), tile, 0.48, 36);
    text(footer, tile, 0.81);
  }

  function drawSteps() {
    var steps = Bangle.getHealthStatus("day").steps;
    if (previous[2] === steps) return;
    previous[2] = steps;
    var tile = beginTile(2, "STEPS");
    var value = "" + steps;
    var groups = "";
    // Espruino's small regexp engine does not support lookahead.
    while (value.length > 3) {
      groups = "," + value.slice(-3) + groups;
      value = value.slice(0, -3);
    }
    text(value + groups, tile, 0.48, 32);
    text("TODAY", tile, 0.81);
  }

  function drawBattery() {
    var level = Math.max(0, Math.min(100, Math.round(E.getBattery())));
    var charging = Bangle.isCharging();
    var key = level + ":" + charging;
    if (previous[3] === key) return;
    previous[3] = key;
    var tile = beginTile(3, "BATTERY");
    text(level + "%", tile, 0.46, 32);
    var x = tile.x + Math.floor((tile.w - 30) / 2);
    var y = tile.y + Math.round(tile.h * 0.68);
    g.drawRect(x, y, x + 27, y + 10);
    g.fillRect(x + 28, y + 3, x + 30, y + 7);
    g.setColor(level <= 15 ? "#f00" : level <= 30 ? "#ff0" : "#0f0");
    var fill = Math.round(24 * level / 100);
    if (fill > 0) g.fillRect(x + 2, y + 2, x + 1 + fill, y + 8);
    if (charging) {
      g.setColor("#0ff");
      text("CHARGING", tile, 0.89);
    }
  }

  function draw() {
    var date = new Date();
    drawTime(date);
    drawDate(date);
    drawSteps();
    drawBattery();
  }

  function redraw() {
    previous = [];
    draw();
  }

  function queueMinute() {
    minuteTimer = setTimeout(function () {
      minuteTimer = undefined;
      draw();
      queueMinute();
    }, 60000 - Date.now() % 60000);
  }

  function onStep() {
    // Coalesce bursts of steps, while still showing the latest daily total.
    if (stepTimer !== undefined) return;
    stepTimer = setTimeout(function () {
      stepTimer = undefined;
      drawSteps();
    }, 1000);
  }

  function onUnlock(locked) {
    if (!locked) {
      if (minuteTimer !== undefined) clearTimeout(minuteTimer);
      draw();
      queueMinute();
    }
  }

  function cleanup() {
    if (minuteTimer !== undefined) clearTimeout(minuteTimer);
    if (stepTimer !== undefined) clearTimeout(stepTimer);
    Bangle.removeListener("step", onStep);
    Bangle.removeListener("charging", drawBattery);
    Bangle.removeListener("lock", onUnlock);
    E.removeListener("kill", cleanup);
  }

  // Standard clock controls: the hardware button opens the launcher.
  // Widgets are omitted so the four tiles use the entire display.
  Bangle.setUI({ mode: "clock", redraw: redraw });
  Bangle.on("step", onStep);
  Bangle.on("charging", drawBattery);
  Bangle.on("lock", onUnlock);
  E.on("kill", cleanup);
  redraw();
  queueMinute();
})();
