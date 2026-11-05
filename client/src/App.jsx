import { Building2, Users, ShieldCheck } from "lucide-react";

function App() {
  return (
    <div className="min-h-screen bg-slate-500 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-brand-600 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white text-2xl font-bold">
          CE
        </div>

        <h1 className="text-3xl font-bold text-brand-800">
          Chandra Enterprises
        </h1>

        <p className="text-slate-500 mt-3">
          Employee Management System
        </p>

        <div className="mt-6 bg-brand-50 text-brand-700 p-4 rounded-xl">
          Tailwind CSS v4 configured successfully!
        </div>
      </div>
    </div>
  );
}

export default App;
