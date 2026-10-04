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
  var reminderTimer;
  var standPending = false;

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

  function beginTile(index, inverted) {
    var tile = tiles[index];
    g.reset().setBgColor(inverted ? "#fff" : "#000")
      .setColor(inverted ? "#fff" : "#000").fillRect(tile.x, tile.y,
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
    g.setColor(inverted ? "#000" : "#fff");
    return tile;
  }

  function drawTime(date) {
    var hours = date.getHours();
    var value = pad2(is12Hour ? (hours % 12 || 12) : hours) + ":" + pad2(date.getMinutes());
    var footer = is12Hour ? (hours < 12 ? "AM" : "PM") : "";
    var key = value + footer;
    if (previous[0] === key) return;
    previous[0] = key;
    var tile = beginTile(0);
    text(value, tile, 0.50, 32);
    if (footer) text(footer, tile, 0.81);
  }

  function drawDate(date) {
    var weekday = locale.dow(date, 1).toUpperCase();
    var footer = locale.month(date, 1).toUpperCase() + " " + date.getFullYear();
    var key = weekday + date.getDate() + footer;
    if (previous[1] === key) return;
    previous[1] = key;
    var tile = beginTile(1);
    text(weekday, tile, 0.17, 18);
    text("" + date.getDate(), tile, 0.49, 36);
    text(footer, tile, 0.84, 16);
  }

  function drawSteps() {
    if (standPending) {
      if (previous[2] === "stand") return;
      previous[2] = "stand";
      var reminderTile = beginTile(2, true);
      text("STAND", reminderTile, 0.37, 24);
      text("UP", reminderTile, 0.67, 24);
      return;
    }
    var steps = Bangle.getHealthStatus("day").steps;
    if (previous[2] === steps) return;
    previous[2] = steps;
    var tile = beginTile(2);
    var value = "" + steps;
    var groups = "";
    // Espruino's small regexp engine does not support lookahead.
    while (value.length > 3) {
      groups = "," + value.slice(-3) + groups;
      value = value.slice(0, -3);
    }
    text(value + groups, tile, 0.50, 34);
  }

  function drawBattery() {
    var level = Math.max(0, Math.min(100, Math.round(E.getBattery())));
    var charging = Bangle.isCharging();
    var key = level + ":" + charging;
    if (previous[3] === key) return;
    previous[3] = key;
    var tile = beginTile(3);
    text(level + "%", tile, 0.50, 32);
    if (charging) {
      text("CHARGING", tile, 0.84, 12);
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

  function onReminder() {
    standPending = true;
    drawSteps();
    Bangle.buzz(500);
  }

  function onTouch(button, position) {
    if (!standPending || !position) return;
    var tile = tiles[2];
    if (position.x < tile.x || position.x >= tile.x + tile.w ||
        position.y < tile.y || position.y >= tile.y + tile.h) return;
    standPending = false;
    // Read the current total, including steps taken while the reminder was up.
    drawSteps();
  }

  function cleanup() {
    if (minuteTimer !== undefined) clearTimeout(minuteTimer);
    if (stepTimer !== undefined) clearTimeout(stepTimer);
    if (reminderTimer !== undefined) clearInterval(reminderTimer);
    Bangle.removeListener("step", onStep);
    Bangle.removeListener("charging", drawBattery);
    Bangle.removeListener("lock", onUnlock);
    Bangle.removeListener("touch", onTouch);
    E.removeListener("kill", cleanup);
  }

  // Standard clock controls: the hardware button opens the launcher.
  // Widgets are omitted so the four tiles use the entire display.
  Bangle.setUI({ mode: "clock", redraw: redraw, touch: onTouch });
  Bangle.on("step", onStep);
  Bangle.on("charging", drawBattery);
  Bangle.on("lock", onUnlock);
  E.on("kill", cleanup);
  redraw();
  queueMinute();
  // Repeat every five minutes while this clock is running, including locked.
  reminderTimer = setInterval(onReminder, 5 * 60 * 1000);
})();
