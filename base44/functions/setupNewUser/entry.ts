import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has Settings
    const existingSettings = await base44.entities.Settings.filter({
      owner_user_id: user.id,
    });

    if (existingSettings.length > 0) {
      return Response.json({ message: 'User already initialized' });
    }

    // Create default Settings for new user
    const settingsData = {
      owner_user_id: user.id,
      setting_key: 'default',
      business_name: '',
      electricity_rate: 0,
      monthly_overhead: 0,
      default_markup: 0,
      etsy_listing_fee: 0.2,
      etsy_transaction_fee_percent: 6.5,
      payment_processing_fee_percent: 3.0,
      payment_processing_fee_fixed: 0.25,
      share_save_rate_pct: 4.0,
      advertising_type: 'none',
      etsy_ads_rate: 0,
      offsite_ads_rate: 15,
      paypal_fee_percent: 2.99,
      paypal_fee_fixed: 0.49,
      square_fee_percent: 3.3,
      square_fee_fixed: 0.3,
      venmo_business_fee_percent: 1.9,
      venmo_business_fee_fixed: 0.1,
      fee_country: 'US',
      custom_sale_a_label: 'Custom Sale A',
      custom_sale_b_label: 'Custom Sale B',
      custom_expense_a_label: 'Custom Expense A',
      custom_expense_b_label: 'Custom Expense B',
    };

    await base44.entities.Settings.create(settingsData);

    // Create default BudgetPlan
    await base44.entities.BudgetPlan.create({
      owner_user_id: user.id,
      name: 'Default Budget',
      is_active: true,
    });

    return Response.json({
      message: 'User initialized successfully',
      user_id: user.id,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});