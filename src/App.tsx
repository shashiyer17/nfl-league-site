import { BrowserRouter, Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import LeagueHistory from "./pages/LeagueHistory";
import SeasonsIndex from "./pages/SeasonsIndex";
import SeasonDetail from "./pages/SeasonDetail";
import AllTimeStandings from "./pages/AllTimeStandings";
import TeamPage from "./pages/TeamPage";
import HeadToHead from "./pages/HeadToHead";
import DraftLab from "./pages/DraftLab";
import Stats from "./pages/Stats";

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<LeagueHistory />} />
        <Route path="/seasons" element={<SeasonsIndex />} />
        <Route path="/season/:year" element={<SeasonDetail />} />
        <Route path="/standings" element={<AllTimeStandings />} />
        <Route path="/draft-lab" element={<DraftLab />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/team/:userId" element={<TeamPage />} />
        <Route path="/h2h" element={<HeadToHead />} />
        <Route path="/h2h/:userIdA/:userIdB" element={<HeadToHead />} />
        <Route path="*" element={<LeagueHistory />} />
      </Routes>
    </BrowserRouter>
  );
}
