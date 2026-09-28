import fs from "fs";

const filePath = "c:/Users/khush/Desktop/tapx/app/client/page.tsx";
let code = fs.readFileSync(filePath, "utf-8");

// Find start of SettingsPage function and end of SettingsPage component (before SettingRow or styles)
const startMarker = "function SettingsPage({";
const endMarker = "function SettingRow({";

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not locate SettingsPage section markers!");
  process.exit(1);
}

const newSettingsPageCode = `function SettingsPage({
  business,
  email,
  onUpdateBusiness,
}: {
  business: Business;
  email: string;
  onUpdateBusiness?: (updated: Business) => void;
}) {
  const [name, setName] = useState(business.name || "");
  const [category, setCategory] = useState(business.category || "custom");
  const [phone, setPhone] = useState(business.phone || "");
  const [whatsappNumber, setWhatsappNumber] = useState(business.whatsapp_number || "");
  const [businessEmail, setBusinessEmail] = useState(business.email || "");
  const [address, setAddress] = useState(business.address || "");
  const [city, setCity] = useState(business.city || "");
  const [state, setState] = useState(business.state || "");
  const [googleReviewUrl, setGoogleReviewUrl] = useState(business.google_review_url || "");
  const [instagramUrl, setInstagramUrl] = useState(business.instagram_url || "");
  const [upiId, setUpiId] = useState(business.upi_id || "");
  const [paymentUrl, setPaymentUrl] = useState(business.payment_url || "");
  const [paymentEnabled, setPaymentEnabled] = useState(business.payment_enabled ?? true);
  const [logoUrl, setLogoUrl] = useState(business.logo_url || "");

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  useEffect(() => {
    setName(business.name || "");
    setCategory(business.category || "custom");
    setPhone(business.phone || "");
    setWhatsappNumber(business.whatsapp_number || "");
    setBusinessEmail(business.email || "");
    setAddress(business.address || "");
    setCity(business.city || "");
    setState(business.state || "");
    setGoogleReviewUrl(business.google_review_url || "");
    setInstagramUrl(business.instagram_url || "");
    setUpiId(business.upi_id || "");
    setPaymentUrl(business.payment_url || "");
    setPaymentEnabled(business.payment_enabled ?? true);
    setLogoUrl(business.logo_url || "");
  }, [business]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    setErrorBanner("");

    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        phone: phone.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        email: businessEmail.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        google_review_url: googleReviewUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        upi_id: upiId.trim() || null,
        payment_url: paymentUrl.trim() || null,
        payment_enabled: paymentEnabled,
        logo_url: logoUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", business.id)
        .select()
        .single();

      if (error) throw error;

      setSavedBanner(true);
      if (onUpdateBusiness && data) {
        onUpdateBusiness(data as Business);
      }
      setTimeout(() => setSavedBanner(false), 5000);
    } catch (err: any) {
      console.error("Error saving business profile:", err);
      setErrorBanner(err?.message || "Failed to update business profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="settings-page">
      <div className="settings-intro">
        <div>
          <div className="eyebrow">BUSINESS CONFIGURATION</div>
          <h1>Settings & Profile</h1>
          <p>Manage your business information, location details, review links, and payment methods.</p>
        </div>
        <button type="submit" disabled={saving} className="save-btn">
          {saving ? "Saving Changes..." : "Save Business Profile"}
        </button>
      </div>

      {savedBanner && (
        <div className="banner success-banner">
          ✓ Business profile updated successfully! All changes are live immediately across customer tap pages.
        </div>
      )}

      {errorBanner && (
        <div className="banner error-banner">
          ⚠️ {errorBanner}
        </div>
      )}

      <div className="settings-grid">
        {/* PANEL 1: GENERAL IDENTITY */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>General Identity</h3>
            <span>PROFILE</span>
          </div>

          <div className="input-group">
            <label>Business Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Yuva Selection"
            />
          </div>

          <div className="input-group">
            <label>Business Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="restaurant">Restaurant & Dining</option>
              <option value="salon">Salon & Spa</option>
              <option value="hotel">Hotel & Resort</option>
              <option value="cafe">Cafe & Bakery</option>
              <option value="retail">Retail Store</option>
              <option value="healthcare">Healthcare & Clinic</option>
              <option value="real_estate">Real Estate</option>
              <option value="custom">Custom / Other</option>
            </select>
          </div>

          <div className="input-group">
            <label>Logo Image URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        {/* PANEL 2: CONTACT & CHANNELS */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Contact & Channels</h3>
            <span>COMMUNICATION</span>
          </div>

          <div className="input-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 07387879977"
            />
          </div>

          <div className="input-group">
            <label>WhatsApp Number</label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. 917387879977"
            />
          </div>

          <div className="input-group">
            <label>Public Business Email</label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="contact@business.com"
            />
          </div>
        </div>

        {/* PANEL 3: LOCATION & REVIEWS */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Location & Reviews</h3>
            <span>MAPS & REVIEWS</span>
          </div>

          <div className="input-group">
            <label>Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Main Road Shrirampur, Near Mamta Sweets"
            />
          </div>

          <div className="grid-2">
            <div className="input-group">
              <label>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Shrirampur"
              />
            </div>
            <div className="input-group">
              <label>State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
              />
            </div>
          </div>

          <div className="input-group">
            <label>Google Review Link</label>
            <input
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/.../review"
            />
          </div>

          <div className="input-group">
            <label>Instagram Handle / Link</label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/yourbusiness"
            />
          </div>
        </div>

        {/* PANEL 4: PAYMENTS & UPI */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Payments & UPI</h3>
            <span>TRANSACTIONS</span>
          </div>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="paymentEnabledToggle"
              checked={paymentEnabled}
              onChange={(e) => setPaymentEnabled(e.target.checked)}
            />
            <label htmlFor="paymentEnabledToggle">Enable Customer Payments on Tap Page</label>
          </div>

          <div className="input-group">
            <label>UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yuvaselection@upi"
            />
          </div>

          <div className="input-group">
            <label>Payment Link / Portal URL</label>
            <input
              type="url"
              value={paymentUrl}
              onChange={(e) => setPaymentUrl(e.target.value)}
              placeholder="https://razorpay.me/@yuvaselection"
            />
          </div>

          <div className="input-group">
            <label>Account Login Email (Read Only)</label>
            <input type="text" disabled value={email || "Authenticated account"} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={saving} className="save-btn">
          {saving ? "Saving Changes..." : "Save Business Profile"}
        </button>
      </div>

      <style jsx>{\`
        .settings-page {
          max-width: 1000px;
          margin: 0 auto;
        }

        .eyebrow {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.18em;
          margin-bottom: 9px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        .settings-intro {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .settings-intro p {
          color: #8d96a2;
          font-size: 13px;
          margin: 8px 0 0;
        }

        .save-btn {
          background: #0f172a;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
        }

        .save-btn:hover {
          background: #1e293b;
          transform: translateY(-1px);
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .banner {
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          margin-top: 20px;
        }

        .success-banner {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .error-banner {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 25px;
        }

        .settings-panel {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          padding: 24px;
        }

        .settings-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .settings-heading h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .settings-heading span {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        .input-group {
          margin-bottom: 16px;
        }

        .input-group:last-child {
          margin-bottom: 0;
        }

        .input-group label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 6px;
        }

        .input-group input,
        .input-group select {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease;
          background: #f8fafc;
        }

        .input-group input:focus,
        .input-group select:focus {
          border-color: #0f172a;
          background: white;
        }

        .input-group input:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }

        .checkbox-group input {
          width: 16px;
          height: 16px;
          accent-color: #0f172a;
          cursor: pointer;
        }

        .checkbox-group label {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          user-select: none;
        }

        @media (max-width: 700px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }

          .settings-intro {
            flex-direction: column;
            align-items: stretch;
          }

          .save-btn {
            width: 100%;
          }

          h1 {
            font-size: 28px;
          }
        }
      \`}</style>
    </form>
  );
}\n\n`;

code = code.substring(0, startIndex) + newSettingsPageCode + code.substring(endIndex);
fs.writeFileSync(filePath, code, "utf-8");
console.log("SettingsPage successfully updated with interactive Business Profile form!");
