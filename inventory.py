# PyInfra Inventory File
# Defines a 3-node cluster with romulus group

# Individual nodes with their IP addresses
remus = "172.16.4.50"
numa = "172.16.5.50" 
titus = "172.16.100.50"

# Group that combines all nodes
romulus = [
    "172.16.4.50",  # remus
    "172.16.5.50",  # numa
    "172.16.100.50" # titus
] 