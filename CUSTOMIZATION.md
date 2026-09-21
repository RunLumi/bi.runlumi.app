# Customization

An installation repository can replace pages, navigation, branding, dashboards,
server endpoints, metrics, connectors, analytical context, workflows, and tests.
Use the public interfaces exported by the versioned core packages. Keep custom
files outside installed package internals so a core update can preserve them.

Custom server code runs with the installation's privileges and must enforce the
same role and source checks. A model may propose text or a semantic plan; model
output must never become executable JavaScript or SQL.
