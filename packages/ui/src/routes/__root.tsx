import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Theme, Box, Flex } from "@radix-ui/themes";
import { getSessionsDb } from "../data/sessionsDb";
import { BookmarksProvider } from "../context/BookmarksContext";

export const Route = createRootRoute({
  loader: async () => {
    await getSessionsDb();
    return {};
  },
  component: RootLayout,
});

function RootLayout() {
  return (
    <Theme
      accentColor="green"
      grayColor="slate"
      radius="small"
      scaling="95%"
      appearance="dark"
    >
      <BookmarksProvider>
        <Box
          px="4"
          py="3"
          style={{
            maxWidth: "1800px",
            margin: "0 auto",
            minHeight: "100vh",
          }}
        >
          <Flex direction="column" gap="3">
            <Outlet />
          </Flex>
        </Box>
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </BookmarksProvider>
    </Theme>
  );
}
