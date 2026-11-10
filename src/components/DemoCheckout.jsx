import React, { useId, useRef, useState } from 'react';
import { CreditCard, FlaskConical } from 'lucide-react';
import { ErrorNotice } from './UI';
import { money } from '../utils';
import { DEMO_CARDS, demoCardExample, formatDemoCardNumber, formatDemoExpiry, validateDemoPayment } from '../demoPayment';

const emptyDetails = { cardholderName: '', cardNumber: '', expiry: '', securityCode: '' };

export default function DemoCheckout({ invoice, busy, onPay, formId }) {
  const [details, setDetails] = useState(emptyDetails), [errors, setErrors] = useState({}), [paymentError, setPaymentError] = useState('');
  const id = useId(), formRef = useRef(null), submitting = useRef(false);
  const update = (name, value) => {
    setDetails(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined })); setPaymentError('');
  };
  const useCard = outcome => { setDetails(demoCardExample(outcome)); setErrors({}); setPaymentError(''); };
  const submit = async event => {
    event.preventDefault(); if (busy || submitting.current) return;
    const result = validateDemoPayment(details); setErrors(result.errors); setPaymentError('');
    const firstError = Object.keys(result.errors)[0];
    if (firstError) { formRef.current.elements.namedItem(`demo-${firstError}`)?.focus(); return; }
    submitting.current = true;
    try { await onPay(result.outcome); }
    catch (error) { setPaymentError(error.message); }
    finally { submitting.current = false; setDetails(previous => ({ ...previous, securityCode: '' })); }
  };
  const field = (name, label, input) => <div className="field"><label htmlFor={`${id}-${name}`}>{label}</label>
    <input {...input} id={`${id}-${name}`} name={`demo-${name}`} value={details[name]} required autoComplete="off"
      aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${id}-${name}-error` : undefined} />
    {errors[name] && <span className="payment-field-error" id={`${id}-${name}-error`}>{errors[name]}</span>}
  </div>;

  return <section className="demo-payment" aria-labelledby={`${id}-title`}>
    <div className="demo-checkout-heading"><div><h3 id={`${id}-title`}>Card details</h3></div><span className="demo-checkout-badge"><FlaskConical size={15} />Demo mode</span></div>
    <p>Pick a sample card to fill the form. Do not enter real card details. No money will be charged.</p>
    <ErrorNotice message={paymentError} />
    <div className="demo-card-presets" role="group" aria-label="Demo test cards">{DEMO_CARDS.map(card => <button type="button" className="demo-card-preset" key={card.outcome} disabled={busy} onClick={() => useCard(card.outcome)}><CreditCard size={19} /><span><strong>Use {card.label.toLowerCase()}</strong><small>{formatDemoCardNumber(card.number)}</small></span></button>)}</div>
    <div className="demo-checkout-layout"><form ref={formRef} id={formId} className="demo-checkout-form" onSubmit={submit} noValidate autoComplete="off" aria-label="Demo card payment details">
      <fieldset disabled={busy}>
        {field('cardholderName', 'Cardholder name', { type: 'text', maxLength: 100, placeholder: 'Alex Demo', onChange: event => update('cardholderName', event.target.value) })}
        {field('cardNumber', 'Card number', { type: 'text', inputMode: 'numeric', maxLength: 19, placeholder: '4242 4242 4242 4242', onChange: event => update('cardNumber', formatDemoCardNumber(event.target.value)) })}
        <div className="form-row">
          {field('expiry', 'Expiry date', { type: 'text', inputMode: 'numeric', maxLength: 5, placeholder: 'MM/YY', onChange: event => update('expiry', formatDemoExpiry(event.target.value)) })}
          {field('securityCode', 'Security code (CVV)', { type: 'password', inputMode: 'numeric', maxLength: 3, placeholder: '123', onChange: event => update('securityCode', event.target.value.replace(/\D/g, '').slice(0, 3)) })}
        </div>
      </fieldset>
    </form><aside className="demo-payment-summary" aria-label="Payment amount"><span className="small muted">Amount due</span><strong>{money(invoice.totalAmount)}</strong><p>{invoice.pricing.premiseName}</p><p className="small muted">{invoice.number}</p></aside></div>
  </section>;
}
