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
        <p>Google handles parent sign-in. Supabase hosts family records and photos. When Penny uses AI, it sends question text with names and numbers removed to DeepSeek, a provider outside Malaysia. Centsibility uses family activity within the app to prepare relevant replies.</p>
        <p>A parent can remove a child through the parent dashboard. Parent account deletion and data export are planned features.</p>
      </section>
      <section lang="ms" className="space-y-3">
        <h2 className="text-2xl font-bold">Notis privasi</h2>
        <p>Versi {PRIVACY_NOTICE_VERSION}</p>
        <p>Centsibility menggunakan nama dan e-mel ibu bapa untuk log masuk dan mengurus akaun keluarga. Kami menyimpan nama dan nama pengguna anak, tarikh lahir dan foto profil jika diberikan, sejarah wang latihan, kemajuan pembelajaran dan tandatangan yang dilukis untuk pinjaman. Maklumat ini digunakan untuk mengurus akaun keluarga, memaparkan aktiviti dan menyesuaikan pelajaran.</p>
        <p>Google mengendalikan log masuk ibu bapa. Supabase menyimpan rekod dan foto keluarga. Apabila Penny menggunakan AI, teks soalan yang telah dibuang nama dan nombor dihantar kepada DeepSeek, penyedia di luar Malaysia. Centsibility menggunakan aktiviti keluarga dalam aplikasi untuk menyediakan jawapan yang berkaitan.</p>
        <p>Ibu bapa boleh membuang akaun anak melalui papan pemuka ibu bapa. Pemadaman akaun ibu bapa dan eksport data dirancang untuk versi akan datang.</p>
      </section>
    </main>
  );
}
