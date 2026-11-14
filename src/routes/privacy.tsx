import { createFileRoute } from "@tanstack/react-router";
import { PRIVACY_NOTICE_VERSION } from "../../supabase/functions/_shared/privacy-version";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy notice | Centsibility" }] }),
  component: PrivacyNotice,
});

function PrivacyNotice() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-5 py-10">
      <section lang="en" className="space-y-3">
        <h1 className="text-3xl font-bold">Privacy notice</h1>
        <p>Version {PRIVACY_NOTICE_VERSION}</p>
        <p>Centsibility uses your parent account name and email to sign you in and manage your family. We store each child’s name, username, optional birth date and profile photo, practice money history, learning progress and any signature drawn for a loan. We use these to run the family account, show activity and tailor lessons.</p>
        <p>Google handles parent sign-in. Supabase hosts family records and photos. When Penny uses AI, it sends question text with names and numbers removed to DeepSeek, a provider outside Malaysia. Centsibility uses family activity within the app to prepare relevant replies. If you turn on push notifications, Centsibility stores your browser push subscription to alert you about requests and approvals.</p>
        <p>Retention rule: family records are kept while your account is active. When you remove a child or delete your parent account, those records and uploaded profile photos are permanently deleted.</p>
        <p>A parent can export the family's data as a JSON file, remove a child, or permanently delete the parent account, all children, data and sign-in from Parent Settings after verifying their PIN.</p>
      </section>
      <section lang="ms" className="space-y-3">
        <h2 className="text-2xl font-bold">Notis privasi</h2>
        <p>Versi {PRIVACY_NOTICE_VERSION}</p>
        <p>Centsibility menggunakan nama dan e-mel ibu bapa untuk log masuk dan mengurus akaun keluarga. Kami menyimpan nama dan nama pengguna anak, tarikh lahir dan foto profil jika diberikan, sejarah wang latihan, kemajuan pembelajaran dan tandatangan yang dilukis untuk pinjaman. Maklumat ini digunakan untuk mengurus akaun keluarga, memaparkan aktiviti dan menyesuaikan pelajaran.</p>
        <p>Google mengendalikan log masuk ibu bapa. Supabase menyimpan rekod dan foto keluarga. Apabila Penny menggunakan AI, teks soalan yang telah dibuang nama dan nombor dihantar kepada DeepSeek, penyedia di luar Malaysia. Centsibility menggunakan aktiviti keluarga dalam aplikasi untuk menyediakan jawapan yang berkaitan. Jika anda mengaktifkan pemberitahuan tolak, Centsibility menyimpan langganan pelayar anda untuk memaklumkan permintaan dan kelulusan.</p>
        <p>Peraturan penyimpanan: rekod keluarga disimpan selagi akaun anda aktif. Apabila anda membuang anak atau memadam akaun ibu bapa, rekod berkaitan dan foto profil yang dimuat naik akan dipadamkan secara kekal.</p>
        <p>Ibu bapa boleh mengeksport semua data keluarga sebagai fail JSON, membuang anak, atau memadam akaun ibu bapa, semua anak, data dan log masuk secara kekal melalui Tetapan Ibu Bapa selepas mengesahkan PIN.</p>
      </section>
    </main>
  );
}
