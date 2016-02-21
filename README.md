# homebridge-milight
Saturation extension to homebridge-milight (https://github.com/dotsam/homebridge-milight). Most users would want to use the homebridge-milight plugin instead.

MiLight/LimitlessLED/Easybulb Plugin for [Homebridge](https://github.com/nfarina/homebridge)

This plugin facilitates my own (unique) setup, combining two MiLight LED strip controllers into one device. First controller is used for RGB, second for white control on the same strip in order to overcome MiLight limitations.

# Configuration

Example config:

```
""platforms": [
    {
        "platform":"MiLightSat",
        "name":"MiLightSat",
        "bridges": [
          {
            "ip_address": "192.168.8.50",
            "lights": [
              {
                "name": "Woonkamer",
                "saturation": true,
                "zones": [
                  {"zone": 1, "function": "rgb", "type": "rgbw"},
                  {"zone": 2, "function": "white", "type": "rgbw"}
                ]
              },
              {
                "name": "Kast",
                "saturation": false,
                "zones": [
                  {"zone": 3, "function": "rgb", "type": "rgbw"}
                ]
              }
            ],
            "repeat": 2,
            "delay": 50
          }
        ]
    }
]

```

Where the parameters are:

 * platform: This must be "MiLightSat", and refers to the name of the platform as defined in the module (required)
 * name: The display name used for logging output by Homebridge. Could be "MiLight" or "LimitlessLED" or whatever you'd like to see in logs and as the Manufacturer
 * bridges: An array of the bridges that will be configured by the platform, containing the following keys
   * ip_address: The IP address of the WiFi Bridge (optional - default: 255.255.255.255 aka broadcast to all bridges)
   * port: Port of the WiFi bridge (optional - default 8899)
   * lights: Each light pops up as an Accessory in Homebridge, and can consist of multiple zones.
     * name: Name of the Accessory
     * saturation: Should this Accessory have a saturation characteristic?
        * zone: number of the zone
        * function: does this zone provide rgb or white functionality
        * type: One of either "rgbw", "rgb", or "white", depending on the type of bulb/controller being controlled.
   * delay: Delay in ms between commands sent over UDP. May cause heavy command queuing when set too high. Try decreasing to improve preformance (optional - default 30)
   * repeat: Number of times to repeat the UDP command for better reliability. For rgb or white bulbs, this should be set to 1 so as not to change brightness/temperature more than desired (optional - default 3)


# Tips and Trick
 * A brighness setting of 0% is equivilant to sending an Off command
 * White and rgb bulbs don't support absolute brightness setting, so we just send a brightness up/brightness down command depending if we got a percentage above/below 50% respectively
 * The only exception to the above is that white bulbs support a "maximum brightness" command, so we send that when we get 100%
 * Implemented warmer/cooler for white lamps in a similar way to brightnes, except this time above/below 180 degrees on the colour wheel

# Troubleshooting
The node-milight-promise library provides additional debugging output when the MILIGHT_DEBUG environmental variable is set

# Changelog

### 0.0.1
 * Initial release
