// Edge Function: cancel-order
// تضاف هذه الدالة إلى مشروع Supabase لديك (نفس مكان create-order و admin-update-order)
//
// النشر عبر Supabase CLI:
//   supabase functions deploy cancel-order
//
// أو عبر لوحة Supabase: Edge Functions -> Create a new function -> اسمها cancel-order
// والصق هذا الكود.
//
// ⚠️ مهم: هذا الكود يفترض أن جدول kh_orders يحتوي عمود يربط الطلب بحساب الزبون
// (مثلاً user_id أو customer_id). إذا اسم العمود عندك مختلف، عدّل السطر المعلّم أدناه.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// الحالات التي يُسمح فيها للزبون بإلغاء طلبه (قبل ما يصير بالطريق أو يوصل)
const CANCELLABLE_STATUSES = ["new", "confirmed", "preparing"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id مطلوب" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    // عميل بصلاحيات المستخدم المُرسل (للتحقق من هويته فقط)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "يجب تسجيل الدخول" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // عميل بصلاحيات كاملة لقراءة/تعديل الطلب (service role)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderErr } = await admin
      .from("kh_orders")
      .select("id,status,user_id") // عدّل user_id هنا لاسم العمود الصحيح عندك إذا مختلف
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "الطلب غير موجود" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // تأكد أن الطلب يخص نفس المستخدم المسجل
    if (order.user_id && order.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "غير مصرح لك بإلغاء هذا الطلب" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return new Response(
        JSON.stringify({ error: "لا يمكن إلغاء الطلب في هذه المرحلة" }),
        { status: 409, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await admin
      .from("kh_orders")
      .update({ status: "cancelled" })
      .eq("id", order_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
