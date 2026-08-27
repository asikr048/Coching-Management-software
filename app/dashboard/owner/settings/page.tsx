export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Settings</h2><p className="text-sm text-gray-500 mt-1">Manage system configuration</p></div>
      <div className="max-w-2xl space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">General Settings</h3>
          <div className="space-y-4 text-sm text-gray-600">
            <p>Center Name: <strong>MedhaShiri</strong></p>
            <p>SMS Provider: <strong>Mock (Test Mode)</strong></p>
            <p>Payment Gateway: <strong>SSLCommerz (Sandbox)</strong></p>
            <p>Default Fee Due Day: <strong>10th of every month</strong></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Supabase Connection</h3>
          <p className="text-sm text-gray-500">Configure your Supabase URL and keys in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env.local</code> file.</p>
        </div>
      </div>
    </div>
  )
}
