import ledLights from "../assets/images/led-lights.webp";
import switchesSockets from "../assets/images/switches-sockets.webp";
import electricalWiring from "../assets/images/electrical-wiring.webp";
import circuitBreaker from "../assets/images/circuit-breaker.webp";
import ceilingFan from "../assets/images/ceiling-fan.webp";
import homeAppliance from "../assets/images/home-appliance.webp";
import airConditioner from "../assets/images/air-conditioner.webp";
import showroom from "../assets/images/showroom-lighting.webp";

export const categories = [
  { name: "LED Lights", subtitle: "Indoor & outdoor", icon: "sun", image: ledLights },
  { name: "Switches & Sockets", subtitle: "Modular & standard", icon: "plug", image: switchesSockets },
  { name: "Wires & Cables", subtitle: "Havells, Polycab & more", icon: "cable", image: electricalWiring },
  { name: "MCB & Electrical Safety", subtitle: "MCB, RCCB, DB & more", icon: "shield", image: circuitBreaker },
  { name: "Fans", subtitle: "Ceiling, wall & exhaust", icon: "fan", image: ceilingFan },
  { name: "Air Conditioners", subtitle: "Split, window & coolers", icon: "wind", image: airConditioner },
  { name: "Home Appliances", subtitle: "TV, fridge, washing machine", icon: "house", image: homeAppliance },
  { name: "Electrical Accessories", subtitle: "Conduits, boxes & more", icon: "settings", image: showroom },
];
