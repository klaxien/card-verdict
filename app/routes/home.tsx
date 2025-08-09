import type {Route} from "./+types/home";
import HomePanel from "~/components/homePanel/HomePanel";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Card Verdict"},
        {name: "description", content: "Card Verdict"},
    ];
}

export default function Home() {
    return <HomePanel/>;
}
