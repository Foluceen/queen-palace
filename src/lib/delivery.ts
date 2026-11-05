/**
 * How delivery works (from the owner): the customer gives their address, phone and email. The
 * shop sends the order through a park or driver; when it reaches the customer's area the driver
 * calls them with the price to bring it to their address, and the customer pays the driver.
 * Nothing about delivery is chosen or charged on the site.
 */
export const DELIVERY_RATE_ID = "park_driver";
export const DELIVERY_LABEL = "Sent through a park or driver";
export const DELIVERY_SUMMARY =
  "We send your order through a trusted park or driver. When it reaches your area, the driver will call you with the price to bring it to your address, and you pay the driver directly.";
/** Shown wherever a delivery cost would be. */
export const DELIVERY_COST_TEXT = "Pay the driver on arrival";
