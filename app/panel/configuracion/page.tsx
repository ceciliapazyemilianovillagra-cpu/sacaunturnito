import ManagementModule from '../../components/ManagementModule';
import SettingsTools from '../../components/SettingsTools';

export default function Page() {
  return (
    <>
      <ManagementModule mode="settings" />
      <SettingsTools />
    </>
  );
}
