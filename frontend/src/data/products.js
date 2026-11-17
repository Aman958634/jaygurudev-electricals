import ledLights from "../assets/images/led-lights.webp";
import switchesSockets from "../assets/images/switches-sockets.webp";
import electricalWiring from "../assets/images/electrical-wiring.webp";
import circuitBreaker from "../assets/images/circuit-breaker.webp";
import ceilingFan from "../assets/images/ceiling-fan.webp";
import homeAppliance from "../assets/images/home-appliance.webp";
import airConditioner from "../assets/images/air-conditioner.webp";
import washingMachine from "../assets/images/washing-machine.webp";
import showroomLighting from "../assets/images/showroom-lighting.webp";

export const products = [
  { id: 1, name: "LED Bulb", brand: "Philips", category: "LED Lights", size: "9W / 12W", image: ledLights, badge: "Lighting" },
  { id: 2, name: "Modular Switch", brand: "Havells", category: "Switches & Sockets", size: "1 Way, 2 Way", image: switchesSockets, badge: "Switchgear" },
  { id: 3, name: "FR Wire", brand: "Polycab", category: "Wires & Cables", size: "1.0 / 1.5 / 2.5 Sqmm", image: electricalWiring, badge: "Wiring" },
  { id: 4, name: "MCB", brand: "Havells", category: "MCB & Electrical Safety", size: "6A to 63A", image: circuitBreaker, badge: "Safety" },
  { id: 5, name: "Ceiling Fan", brand: "Crompton", category: "Fans", size: "1200mm, High Speed", image: ceilingFan, badge: "Comfort" },
  { id: 6, name: "Air Conditioner", brand: "Voltas", category: "Air Conditioners", size: "1 Ton / 1.5 Ton", image: airConditioner, badge: "Cooling" },
  { id: 7, name: "Refrigerator", brand: "LG", category: "Home Appliances", size: "Multiple capacities", image: homeAppliance, badge: "Appliance" },
  { id: 8, name: "Washing Machine", brand: "Samsung", category: "Home Appliances", size: "Multiple models", image: washingMachine, badge: "Appliance" },
  { id: 9, name: "LED Panel Light", brand: "Philips", category: "LED Lights", size: "12W / 18W / 24W", image: showroomLighting, badge: "Lighting" },
  { id: 10, name: "DP MCB", brand: "Havells", category: "MCB & Electrical Safety", size: "SP / DP / TP", image: circuitBreaker, badge: "Safety" },
  { id: 11, name: "Roma Socket", brand: "Anchor", category: "Switches & Sockets", size: "6A / 16A", image: switchesSockets, badge: "Switchgear" },
  { id: 12, name: "Smart Switch", brand: "Legrand", category: "Electrical Accessories", size: "Ask for available models", image: switchesSockets, badge: "Smart home" },
];
