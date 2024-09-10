# https://stackoverflow.com/a/28938235

print_success() {
    Color='\033[0;102m'   
    Color_Off='\033[0m'

    echo -e "\n${Color}### $1...${Color_Off}"
}

print_fail() {
    Color='\033[0;101m'
    Color_Off='\033[0m'

    echo -e "\n${Color}### $1...${Color_Off}"
}