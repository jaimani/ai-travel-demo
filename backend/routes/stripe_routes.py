"""
Stripe payment and subscription routes
"""
import os
import stripe
from fastapi import APIRouter, HTTPException, Header, Request, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from sqlmodel import Session, select
from datetime import datetime
from dotenv import load_dotenv

from models.database import Customer, get_session, get_or_create_customer

load_dotenv()

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_LOOKUP_KEY = os.getenv("STRIPE_PRICE_LOOKUP_KEY", "Premium_travel_assistant-6375498")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter()

@router.post("/create-checkout-session")
async def create_checkout_session(
    request: Request,
    session: Session = Depends(get_session)
):
    """Create a Stripe Checkout session for subscription"""
    try:
        data = await request.json()
        user_email = data.get("email")

        if not user_email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Get or create customer in our database
        customer = get_or_create_customer(session, user_email)

        # Create or retrieve Stripe customer
        if customer.stripe_customer_id:
            stripe_customer = stripe.Customer.retrieve(customer.stripe_customer_id)
        else:
            stripe_customer = stripe.Customer.create(email=user_email)
            customer.stripe_customer_id = stripe_customer.id
            session.add(customer)
            session.commit()

        # Get the price using lookup key
        prices = stripe.Price.list(
            lookup_keys=[STRIPE_PRICE_LOOKUP_KEY],
            expand=['data.product']
        )

        if not prices.data:
            raise HTTPException(
                status_code=500,
                detail=f"Price with lookup key '{STRIPE_PRICE_LOOKUP_KEY}' not found in Stripe"
            )

        # Create Checkout Session
        checkout_session = stripe.checkout.Session.create(
            customer=stripe_customer.id,
            line_items=[
                {
                    'price': prices.data[0].id,
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=FRONTEND_URL + '?success=true&session_id={CHECKOUT_SESSION_ID}',
            cancel_url=FRONTEND_URL + '?canceled=true',
            metadata={
                'customer_email': user_email
            }
        )

        return JSONResponse({
            "sessionId": checkout_session.id,
            "url": checkout_session.url
        })

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/create-portal-session")
async def create_portal_session(
    request: Request,
    session: Session = Depends(get_session)
):
    """Create a Stripe Customer Portal session for managing billing"""
    try:
        data = await request.json()
        email = data.get("email")

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Get customer from database
        statement = select(Customer).where(Customer.email == email)
        customer = session.exec(statement).first()

        if not customer or not customer.stripe_customer_id:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Create portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=customer.stripe_customer_id,
            return_url=FRONTEND_URL,
        )

        return JSONResponse({
            "url": portal_session.url
        })

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating portal session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/subscription-status/{email}")
async def get_subscription_status(
    email: str,
    session: Session = Depends(get_session)
):
    """Get subscription status for a customer"""
    try:
        statement = select(Customer).where(Customer.email == email)
        customer = session.exec(statement).first()

        if not customer:
            return JSONResponse({
                "status": "free",
                "tier": "free",
                "hasActiveSubscription": False
            })

        return JSONResponse({
            "status": customer.subscription_status,
            "tier": customer.subscription_tier,
            "hasActiveSubscription": customer.subscription_status == "active" and customer.subscription_tier == "premium",
            "currentPeriodEnd": customer.current_period_end
        })

    except Exception as e:
        print(f"Error getting subscription status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    session: Session = Depends(get_session)
):
    """Handle Stripe webhook events"""
    try:
        payload = await request.body()

        # Verify webhook signature
        if STRIPE_WEBHOOK_SECRET:
            try:
                event = stripe.Webhook.construct_event(
                    payload, stripe_signature, STRIPE_WEBHOOK_SECRET
                )
            except stripe.error.SignatureVerificationError as e:
                print(f"Webhook signature verification failed: {e}")
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            # For development without signature verification
            import json
            event = json.loads(payload)

        event_type = event['type']
        data_object = event['data']['object']

        print(f"Received webhook event: {event_type}")

        # Handle different event types
        if event_type == 'checkout.session.completed':
            # Payment successful, subscription created
            handle_checkout_completed(session, data_object)

        elif event_type == 'customer.subscription.created':
            handle_subscription_created(session, data_object)

        elif event_type == 'customer.subscription.updated':
            handle_subscription_updated(session, data_object)

        elif event_type == 'customer.subscription.deleted':
            handle_subscription_deleted(session, data_object)

        elif event_type == 'invoice.payment_succeeded':
            handle_payment_succeeded(session, data_object)

        elif event_type == 'invoice.payment_failed':
            handle_payment_failed(session, data_object)

        return JSONResponse({"status": "success"})

    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Webhook event handlers
def handle_checkout_completed(session: Session, checkout_session):
    """Handle successful checkout"""
    customer_email = checkout_session.get('customer_email') or checkout_session['metadata'].get('customer_email')
    stripe_customer_id = checkout_session['customer']
    subscription_id = checkout_session.get('subscription')

    if customer_email:
        statement = select(Customer).where(Customer.email == customer_email)
        customer = session.exec(statement).first()

        if customer:
            customer.stripe_customer_id = stripe_customer_id
            customer.subscription_status = "active"
            customer.subscription_tier = "premium"
            customer.stripe_subscription_id = subscription_id
            customer.updated_at = datetime.utcnow().isoformat()

            # Try to fetch subscription details to get current_period_end
            if subscription_id:
                try:
                    import stripe as stripe_lib
                    subscription = stripe_lib.Subscription.retrieve(subscription_id)
                    customer.current_period_end = datetime.fromtimestamp(subscription['current_period_end']).isoformat()
                    print(f"✅ Set current_period_end: {customer.current_period_end}")
                except Exception as e:
                    print(f"⚠️ Could not fetch subscription details: {e}")

            session.add(customer)
            session.commit()
            print(f"✅ Checkout completed for {customer_email}")


def handle_subscription_created(session: Session, subscription):
    """Handle subscription creation"""
    stripe_customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')

    if not stripe_customer_id or not subscription_id:
        print(f"⚠️ Missing customer or subscription ID in subscription.created event")
        return

    statement = select(Customer).where(Customer.stripe_customer_id == stripe_customer_id)
    customer = session.exec(statement).first()

    if customer:
        customer.stripe_subscription_id = subscription_id
        customer.subscription_status = subscription.get('status', 'active')
        customer.subscription_tier = "premium"

        # Set current_period_end if available
        if 'current_period_end' in subscription:
            customer.current_period_end = datetime.fromtimestamp(subscription['current_period_end']).isoformat()

        customer.updated_at = datetime.utcnow().isoformat()
        session.add(customer)
        session.commit()
        print(f"✅ Subscription created for {customer.email}")


def handle_subscription_updated(session: Session, subscription):
    """Handle subscription updates"""
    stripe_customer_id = subscription.get('customer')
    status = subscription.get('status')

    if not stripe_customer_id:
        print(f"⚠️ Missing customer ID in subscription.updated event")
        return

    statement = select(Customer).where(Customer.stripe_customer_id == stripe_customer_id)
    customer = session.exec(statement).first()

    if customer:
        if status:
            customer.subscription_status = status

        # Set current_period_end if available
        if 'current_period_end' in subscription:
            customer.current_period_end = datetime.fromtimestamp(subscription['current_period_end']).isoformat()

        customer.updated_at = datetime.utcnow().isoformat()

        # Downgrade tier if subscription is not active
        if status and status not in ['active', 'trialing']:
            customer.subscription_tier = "free"

        session.add(customer)
        session.commit()
        print(f"✅ Subscription updated for {customer.email}: {status}")


def handle_subscription_deleted(session: Session, subscription):
    """Handle subscription cancellation"""
    stripe_customer_id = subscription.get('customer')

    if not stripe_customer_id:
        print(f"⚠️ Missing customer ID in subscription.deleted event")
        return

    statement = select(Customer).where(Customer.stripe_customer_id == stripe_customer_id)
    customer = session.exec(statement).first()

    if customer:
        customer.subscription_status = "canceled"
        customer.subscription_tier = "free"
        customer.stripe_subscription_id = None
        customer.current_period_end = None
        customer.updated_at = datetime.utcnow().isoformat()
        session.add(customer)
        session.commit()
        print(f"✅ Subscription canceled for {customer.email}")


def handle_payment_succeeded(session: Session, invoice):
    """Handle successful payment"""
    stripe_customer_id = invoice.get('customer')

    if not stripe_customer_id:
        print(f"⚠️ Missing customer ID in payment.succeeded event")
        return

    statement = select(Customer).where(Customer.stripe_customer_id == stripe_customer_id)
    customer = session.exec(statement).first()

    if customer:
        # Ensure subscription is active on successful payment
        if customer.subscription_tier == "premium":
            customer.subscription_status = "active"
            customer.updated_at = datetime.utcnow().isoformat()
            session.add(customer)
            session.commit()
            print(f"✅ Payment succeeded for {customer.email}")


def handle_payment_failed(session: Session, invoice):
    """Handle failed payment"""
    stripe_customer_id = invoice.get('customer')

    if not stripe_customer_id:
        print(f"⚠️ Missing customer ID in payment.failed event")
        return

    statement = select(Customer).where(Customer.stripe_customer_id == stripe_customer_id)
    customer = session.exec(statement).first()

    if customer:
        customer.subscription_status = "past_due"
        customer.updated_at = datetime.utcnow().isoformat()
        session.add(customer)
        session.commit()
        print(f"⚠️ Payment failed for {customer.email}")
