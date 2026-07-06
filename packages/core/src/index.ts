export { allocateByLargestRemainder } from './allocate.js';
export { allocateDiscount } from './discount.js';
export { splitEvenly } from './split.js';
export {
  itemNetCents,
  validate,
  type BillItem,
  type ComputedTotals,
  type PrintedTotals,
  type ValidateResult,
} from './validate.js';
export { roundHalfAwayFromZero, toMilli } from './money.js';
export {
  DEFAULT_TAX_RATES,
  lineNetCents,
  vatCents,
  type TaxClass,
  type TaxCountry,
  type TaxRates,
} from './tax.js';
