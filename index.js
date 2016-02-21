var Milight = require('node-milight-promise').MilightController;
var commands = require('node-milight-promise').commands;
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform("homebridge-milight-saturation", "MiLightSat", MiLightPlatform);
};

function MiLightPlatform(log, config) {
  this.log = log;
  this.config = config;
}

MiLightPlatform.prototype.accessories = function(callback) {
  var foundLights = [];

  if (this.config.bridges) {

    var bridgesLength = this.config.bridges.length;

    if (bridgesLength === 0) {
      this.log("ERROR: No bridges found in configuration.");
      return;
    } else {
      for (var i = 0; i < bridgesLength; i++) {
        if ( !! this.config.bridges[i]) {
          returnedLights = this._addLights(this.config.bridges[i]);
          foundLights.push.apply(foundLights, returnedLights);
          returnedLights = null;
        }
      }
    }
  } else {
    this.log("ERROR: Could not read any bridges from configuration.");
    return;
  }

  if (foundLights.length > 0) {
    callback(foundLights);
  } else {
    this.log("ERROR: Unable to find any valid lights.");
    return;
  }
};

MiLightPlatform.prototype._addLights = function(bridgeConfig) {
  var lights = [];
  var lightsLength = 0;
  // Various error checking
  if (bridgeConfig.lights) {
    lightsLength = bridgeConfig.lights.length;
  } else {
    this.log("ERROR: Could not read lights from configuration.");
    return;
  }

/*  if (!bridgeConfig["type"]) {
    this.log("INFO: Type not specified, defaulting to rgbw");
    bridgeConfig["type"] = "rgbw";
  }
*/

  if (lightsLength === 0) {
    this.log("ERROR: No lights found in configuration.");
    return;
/*  } else if (bridgeConfig["type"] == "rgb" && zonesLength > 1) {
    this.log("WARNING: RGB lamps only have a single zone. Only the first defined zone will be used.");
    zonesLength = 1;
*/
  } else if (lightsLength > 4) {
    this.log("WARNING: Only a maximum of 4 zones are supported per bridge. Only recognizing the first 4 zones.");
    zonesLength = 4;
  }

  // Initialize a new controller to be used for all zones defined for this bridge
  bridgeController = new Milight({
    ip: bridgeConfig.ip_address,
    port: bridgeConfig.port,
    delayBetweenCommands: bridgeConfig.delay,
    commandRepeat: bridgeConfig.repeat
  });

  // Create lamp accessories for all of the defined lights
  for (var i = 0; i < lightsLength; i++) {
    if ( !! bridgeConfig.lights[i]) {
      lamp = new MiLightAccessory(this.log, bridgeConfig.lights[i], bridgeController);
      lights.push(lamp);
    }
  }

  return lights;
};

function MiLightAccessory(log, lightConfig, bridgeController) {
  this.log = log;

  // config info
  this.name = lightConfig.name;
  this.supportsSaturation = lightConfig.saturation;

  this.log("Added accessory: %s, supports saturation: %s", this.name, this.supportsSaturation.toString());
  // add zones
  this.zones = [];

  for (var i = 0; i < lightConfig.zones.length; i++) {
    if (!! lightConfig.zones[i]) {
      zone = new MiLightZone(this.log, lightConfig.zones[i], bridgeController);
      this.zones.push(zone);
    }
  }
}

function MiLightZone(log, zoneConfig, bridgeController) {
  // add log
  this.log = log;

  // config parameters
  this.zone = zoneConfig.zone;
  this.type = zoneConfig.type.toLowerCase();
  this.function = zoneConfig.function.toLowerCase();

  this.log("Added zone: %d, type: %s, function: %s", this.zone, this.type, this.function);

  // bridge it belongs to
  this.controller = bridgeController;
}

MiLightAccessory.prototype.setPowerState = function(powerOn, callback) {
  this.log("[" + this.name + "] Setting power state to " + powerOn);

  // make sure all changes during sleep are applied
  var hue = this.lightbulbService.getCharacteristic(Characteristic.Hue).value;
  var bright = this.lightbulbService.getCharacteristic(Characteristic.Brightness).value;
  var sat = 100;
  if (this.supportsSaturation) {
    sat = this.lightbulbService.getCharacteristic(Characteristic.Saturation).value;
  }

  // switch power
  for (var i =0; i < this.zones.length; i++) {
    this.zones[i].setPowerState(powerOn);
  }

  // restore settings
  if (powerOn) {
    for (i=0; i < this.zones.length; i++) {
      this.zones[i].setHue(hue);
      this.zones[i].setIntensity(bright,sat);
    }
  }

  callback(null);
};

MiLightZone.prototype.setPowerState = function(powerOn) {
  if (powerOn) {
    this.controller.sendCommands(commands[this.type].on(this.zone));
    // If i'm an RGBW controller used for white only, switch to whitemode
    if (this.type == "rgbw" && this.function == "white") {
      this.controller.sendCommands(commands[this.type].whiteMode(this.zone));
    }
  } else {
    this.controller.sendCommands(commands[this.type].off(this.zone));
  }
};

MiLightAccessory.prototype.setBrightness = function(value, callback) {
  this.log("[" + this.name + "] Setting brightness to %s", value);

  // Check if I'm on
  if (this.lightbulbService.getCharacteristic(Characteristic.On).value)  {

    var sat = 100;
    if (this.supportsSaturation) {
      sat = this.lightbulbService.getCharacteristic(Characteristic.Saturation).value;
    }

    for (var i = 0; i < this.zones.length; i++) {
      this.zones[i].setIntensity(value, sat);
    }
  }
  callback(null);
};

MiLightAccessory.prototype.setSaturation = function(value, callback) {
  this.log("[" + this.name + "] Setting saturation to %s", value);

  // Check if I'm on
  if (this.lightbulbService.getCharacteristic(Characteristic.On).value)  {
    var bright = this.lightbulbService.getCharacteristic(Characteristic.Brightness).value;

    for (var i = 0; i < this.zones.length; i++) {
      this.zones[i].setIntensity(bright, value);
    }
  }
  callback(null);
};

MiLightZone.prototype.setIntensity = function(brightness, saturation) {
  var intesity;

  if (this.function == "rgb") {
    // fade between sat = [0;50]
    intensity = Math.min ((saturation / 100) * 2, 1 ) * brightness;

  } else if (this.function == "white") {
    // fade between sat = [50;100]
    intensity = Math.min (2 - (saturation / 100) * 2, 1 )  * brightness;

  } else {
    // I don't know what type, but ignore saturation and follow brightness
    intensity = brightness;
  }

  if (intensity === 0) {
    // If intensity is set to 0, turn off the lamp
    this.controller.sendCommands(commands[this.type].off(this.zone));

  } else {
    // Send on command to ensure we're addressing the right bulb
    this.controller.sendCommands(commands[this.type].on(this.zone));

    // And set correct intensity
    this.controller.sendCommands(commands[this.type].brightness(intensity));
  }
};


MiLightAccessory.prototype.setHue = function(value, callback) {
  this.log("[" + this.name + "] Setting hue to %s", value);

  //check if I'm on
  if (this.lightbulbService.getCharacteristic(Characteristic.On).value)  {
    for (var i = 0; i < this.zones.length; i++) {
      this.zones[i].setHue(value);
    }
  }
  callback(null);
};

MiLightZone.prototype.setHue = function(value, callback) {

  // Does this zone have color?
  if (this.function == "rgb" || this.function == "rgbw") {

    // Transform to MiLight color
    var hue = commands.rgbw.hsvToMilightColor(Array(value, 0, 0));

    // Send on command to ensure we're addressing the right bulb
    this.controller.sendCommands(commands[this.type].on(this.zone));
    this.controller.sendCommands(commands[this.type].hue(hue));
  }
};



MiLightAccessory.prototype.identify = function(callback) {
  this.log("[" + this.name + "] Identify requested!");
  callback(null); // success
};

MiLightAccessory.prototype.getServices = function() {
  this.informationService = new Service.AccessoryInformation();

  this.informationService
    .setCharacteristic(Characteristic.Manufacturer, this.log.prefix)
    .setCharacteristic(Characteristic.Model, this.name)
    .setCharacteristic(Characteristic.SerialNumber, "12345");

  this.lightbulbService = new Service.Lightbulb(this.name);

  this.lightbulbService
    .getCharacteristic(Characteristic.On)
    .on('set', this.setPowerState.bind(this));

  this.lightbulbService
    .addCharacteristic(new Characteristic.Brightness())
    .on('set', this.setBrightness.bind(this));

  if (this.supportsSaturation) {
    this.lightbulbService
      .addCharacteristic(new Characteristic.Saturation())
      .on('set', this.setSaturation.bind(this));
  }


  this.lightbulbService
    .addCharacteristic(new Characteristic.Hue())
    .on('set', this.setHue.bind(this));

  return [this.informationService, this.lightbulbService];
};
