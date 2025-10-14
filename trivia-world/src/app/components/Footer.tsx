const Footer = () => {
    return (
        <footer className="bg-[#101710] text-white/60 p-4 text-center text-sm">
            <div className="flex flex-col items-center gap-2">
                <div className="flex flex-row flex-wrap items-center justify-center gap-4">
                    <p>&copy; 2026 Trivia World</p>
                    <p>Developed by Rayan Chahid</p>
                </div>

                <a href="mailto:rayanc2005@gmail.com?subject=Trivia%20World%20Feedback" className="mt-1 cursor-pointer hover:underline">
                    Got an idea for a new feature or found a bug?
                </a>
            </div>
        </footer>
    );
};

export default Footer;
